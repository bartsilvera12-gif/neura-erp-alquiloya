import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

/**
 * GET /api/agente/captaciones
 * Devuelve las captaciones del agente logueado.
 * Resuelve auth.users → alquiloya.usuarios → agente_id, y filtra por ese agente_id.
 *
 * 200 { success, captaciones: [...] }
 * 401 sin sesión
 * 403 si la cuenta no está vinculada a un agente AlquiloYa
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no AlquiloYa" }, { status: 403 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // agente_id desde alquiloya.usuarios (la resolver no la trae)
    const uExt = await queryWithRetry<{ agente_id: string | null }>(
      pool,
      `SELECT agente_id FROM alquiloya.usuarios WHERE id=$1::uuid LIMIT 1`,
      [usuario.id]
    );
    const agenteId = uExt.rows?.[0]?.agente_id ?? null;
    if (!agenteId) {
      return NextResponse.json({ error: "Cuenta sin agente vinculado" }, { status: 403 });
    }

    const r = await queryWithRetry(
      pool,
      `SELECT id, propietario_nombre, propietario_email, propietario_telefono,
              propiedad_titulo, tipo_propiedad, ciudad, barrio, direccion,
              precio_estimado::float8 AS precio_estimado,
              mensaje, etapa, estado, origen,
              created_at::text AS created_at,
              updated_at::text AS updated_at
         FROM alquiloya.agente_captaciones
        WHERE empresa_id=$1::uuid AND agente_id=$2::uuid
        ORDER BY created_at DESC
        LIMIT 200`,
      [ALQUILOYA_EMPRESA_ID, agenteId]
    );

    return NextResponse.json({ success: true, captaciones: r.rows ?? [] });
  } catch (err) {
    console.error("[api agente/captaciones GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
