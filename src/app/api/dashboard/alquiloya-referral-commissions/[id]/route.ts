import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const ESTADOS = new Set(["pendiente", "pagada", "cancelada"]);
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/dashboard/alquiloya-referral-commissions/[id]
 *
 * Admin marca una comision como pagada / pendiente / cancelada.
 * Si pagada => setea pagada_at = now(). Si vuelve a pendiente => limpia pagada_at.
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

    const body = (await request.json().catch(() => ({}))) as {
      estado?: string;
      pago_referencia?: string;
    };
    const estado = (body.estado ?? "").trim().toLowerCase();
    if (!ESTADOS.has(estado)) {
      return NextResponse.json({ error: "estado invalido" }, { status: 400 });
    }
    const referencia = (body.pago_referencia ?? "").trim() || null;

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const r = await queryWithRetry<{ id: string; estado: string }>(
      pool,
      `UPDATE "alquiloya"."referral_commissions"
          SET estado = $1,
              pagada_at = CASE WHEN $1 = 'pagada' THEN now() ELSE NULL END,
              pago_referencia = CASE WHEN $1 = 'pagada' THEN $2 ELSE NULL END,
              updated_at = now()
        WHERE id = $3::uuid AND empresa_id = $4::uuid
      RETURNING id, estado`,
      [estado, referencia, id, ALQUILOYA_EMPRESA_ID]
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Comision no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ success: true, id: r.rows[0].id, estado: r.rows[0].estado });
  } catch (err) {
    console.error("[referral-commissions PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
