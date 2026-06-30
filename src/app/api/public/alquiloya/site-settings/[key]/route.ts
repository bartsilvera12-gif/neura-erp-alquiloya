import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const KEY_RE = /^[a-z][a-z0-9_]{1,63}$/;

// Whitelist de keys publicas. Si la key no esta aca, devolvemos 404 — evita
// exponer settings internos (claves, configs sensibles) por accidente.
const PUBLIC_KEYS = new Set([
  "referidos_como_funciona",
  "referidos_terminos",
  "footer_aviso",
]);

let bootstrapped = false;
async function ensureTable(pool: NonNullable<ReturnType<typeof getChatPostgresPool>>) {
  if (bootstrapped) return;
  try {
    await queryWithRetry(
      pool,
      `CREATE TABLE IF NOT EXISTS "alquiloya"."site_settings" (
         empresa_id uuid NOT NULL,
         key text NOT NULL,
         value text,
         updated_at timestamptz NOT NULL DEFAULT now(),
         PRIMARY KEY (empresa_id, key)
       )`,
      []
    );
    bootstrapped = true;
  } catch (e) {
    console.warn("[public site-settings bootstrap]", e instanceof Error ? e.message : e);
  }
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await ctx.params;
    if (!KEY_RE.test(key) || !PUBLIC_KEYS.has(key)) {
      return NextResponse.json({ error: "no encontrada" }, { status: 404 });
    }
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    await ensureTable(pool);

    const r = await queryWithRetry<{ value: string | null }>(
      pool,
      `SELECT value FROM "alquiloya"."site_settings"
        WHERE empresa_id = $1::uuid AND key = $2 LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, key]
    );
    return NextResponse.json({
      success: true,
      key,
      value: r.rows[0]?.value ?? null,
    });
  } catch (err) {
    console.error("[public site-settings GET]", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
