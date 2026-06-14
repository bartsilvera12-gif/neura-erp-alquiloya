import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ETAPAS_OK = new Set(["nuevo", "contacto", "negocio_activo", "cerrado", "rechazado"]);

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/agente/captaciones/[id]
 *
 * Deja al agente logueado mover SU PROPIA captacion por las etapas del
 * embudo (nuevo -> contacto -> negocio_activo -> cerrado / rechazado).
 * El WHERE filtra por agente_id derivado de la sesion, asi un agente no
 * puede tocar leads de otro.
 *
 * Body: { etapa: 'nuevo' | 'contacto' | 'negocio_activo' | 'cerrado' | 'rechazado' }
 *
 * 200 { success, data: { id, etapa, updated_at } }
 * 400 etapa invalida / id invalido
 * 401 sin sesion
 * 403 cuenta sin agente vinculado
 * 404 captacion no encontrada o no es del agente
 */
export async function PATCH(request: Request, ctx: Ctx) {
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

    const uExt = await queryWithRetry<{ agente_id: string | null }>(
      pool,
      `SELECT agente_id FROM alquiloya.usuarios WHERE id=$1::uuid LIMIT 1`,
      [usuario.id]
    );
    const agenteId = uExt.rows?.[0]?.agente_id ?? null;
    if (!agenteId || !uuidRe.test(agenteId)) {
      return NextResponse.json({ error: "Cuenta sin agente vinculado" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as { etapa?: string };
    const etapa = typeof body.etapa === "string" ? body.etapa.trim() : "";
    if (!ETAPAS_OK.has(etapa)) {
      return NextResponse.json(
        { error: "etapa invalida", permitidas: Array.from(ETAPAS_OK) },
        { status: 400 }
      );
    }

    const r = await queryWithRetry<{ id: string; etapa: string; updated_at: string }>(
      pool,
      `UPDATE "alquiloya"."agente_captaciones"
          SET etapa = $1, updated_at = now()
        WHERE empresa_id=$2::uuid AND id=$3::uuid AND agente_id=$4::uuid
        RETURNING id, etapa, updated_at::text AS updated_at`,
      [etapa, ALQUILOYA_EMPRESA_ID, id, agenteId]
    );
    if (!r.rows || r.rows.length === 0) {
      return NextResponse.json({ error: "no encontrada o no es tuya" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error("[api/agente/captaciones/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
