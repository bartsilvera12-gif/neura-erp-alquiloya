import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const ESTADOS = new Set(["nueva", "vista", "respondida", "descartada"]);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/agente/consultas/[id]
 * El agente actualiza el estado (nueva/vista/respondida/descartada) de una
 * consulta que le pertenece. Una consulta le pertenece si c.agente_id matchea
 * O si la propiedad asociada le pertenece (misma logica que el GET).
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no AlquiloYa" }, { status: 403 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const uExt = await queryWithRetry<{ agente_id: string | null }>(
      pool,
      `SELECT agente_id FROM "alquiloya"."usuarios" WHERE id=$1::uuid LIMIT 1`,
      [usuario.id]
    );
    const agenteId = uExt.rows?.[0]?.agente_id ?? null;
    if (!agenteId) return NextResponse.json({ error: "Cuenta sin agente vinculado" }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as { estado?: string };
    const estado = (body.estado ?? "").trim().toLowerCase();
    if (!ESTADOS.has(estado)) {
      return NextResponse.json({ error: "estado invalido" }, { status: 400 });
    }

    // Update solo si la consulta pertenece al agente (directamente o via propiedad)
    const r = await queryWithRetry<{ id: string }>(
      pool,
      `UPDATE "alquiloya"."consultas" c
          SET estado = $1, updated_at = now()
         FROM (SELECT id, agente_id FROM "alquiloya"."propiedades") p
        WHERE c.id = $2::uuid
          AND c.empresa_id = $3::uuid
          AND (c.agente_id = $4::uuid OR (c.propiedad_id = p.id AND p.agente_id = $4::uuid))
      RETURNING c.id`,
      [estado, id, ALQUILOYA_EMPRESA_ID, agenteId]
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Consulta no encontrada o sin permiso" }, { status: 404 });
    }
    return NextResponse.json({ success: true, id: r.rows[0].id, estado });
  } catch (err) {
    console.error("[api/agente/consultas/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
