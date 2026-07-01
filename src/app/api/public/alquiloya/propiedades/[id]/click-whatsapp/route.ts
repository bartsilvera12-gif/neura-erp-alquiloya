import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let bootstrapped = false;
async function ensureColumn(pool: NonNullable<ReturnType<typeof getChatPostgresPool>>) {
  if (bootstrapped) return;
  try {
    await queryWithRetry(
      pool,
      `ALTER TABLE "alquiloya"."propiedades"
         ADD COLUMN IF NOT EXISTS clicks_whatsapp integer NOT NULL DEFAULT 0`,
      []
    );
    bootstrapped = true;
  } catch (e) {
    console.warn("[click-whatsapp bootstrap]", e instanceof Error ? e.message : e);
  }
}

/**
 * POST /api/public/alquiloya/propiedades/[id]/click-whatsapp
 *
 * Contador silencioso de clicks al boton 'Consultar por WhatsApp' de la ficha
 * publica. No pide datos del visitante — solo mide interes por propiedad
 * para que el agente vea cuantas personas quisieron contactar.
 *
 * Dedup del lado del cliente (30 min via localStorage). Aqui confiamos.
 */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    await ensureColumn(pool);

    const r = await queryWithRetry<{ clicks_whatsapp: number }>(
      pool,
      `UPDATE "alquiloya"."propiedades"
          SET clicks_whatsapp = COALESCE(clicks_whatsapp, 0) + 1
        WHERE empresa_id = $1::uuid AND id = $2::uuid
        RETURNING clicks_whatsapp`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: true, clicks: r.rows[0].clicks_whatsapp });
  } catch (err) {
    console.error("[click-whatsapp POST]", err);
    return NextResponse.json({ success: true });
  }
}
