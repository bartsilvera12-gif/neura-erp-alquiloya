// POST /api/dashboard/integraciones-sociales/{id}/retry
// Solo admin. Resetea status a 'pending' y next_retry_at a NULL para que el
// worker la levante en la proxima corrida. Sirve para forzar reintento
// manual de una publicacion fallida.

import { NextResponse } from "next/server";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const ADMIN_ROLES = new Set(["super_admin", "admin", "administrador", "supervisor"]);

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no resuelto" }, { status: 403 });
    }
    if (!ADMIN_ROLES.has(String(usuario.rol || "").toLowerCase())) {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // Solo re-intentables las que estan en failed o pending atascadas. Si el
    // job ya se publico, no permitimos reintentar (evita doble post).
    const { rows } = await queryWithRetry<{ id: string; new_status: string }>(
      pool,
      "UPDATE \"alquiloya\".\"publicaciones_sociales\"" +
      "   SET status = 'pending'," +
      "       next_retry_at = NULL," +
      "       last_error_code = NULL," +
      "       last_error_message = NULL," +
      "       updated_at = now()" +
      " WHERE empresa_id = $1::uuid" +
      "   AND id = $2::uuid" +
      "   AND status IN ('failed','pending','processing')" +
      " RETURNING id, status AS new_status",
      [ALQUILOYA_EMPRESA_ID, id],
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No se puede reintentar (publicacion ya publicada o inexistente)" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, id: rows[0].id, new_status: rows[0].new_status });
  } catch (err) {
    console.error("[api/dashboard/integraciones-sociales/retry]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
