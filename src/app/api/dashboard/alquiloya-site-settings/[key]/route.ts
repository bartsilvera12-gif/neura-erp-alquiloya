import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

// Bootstrap idempotente — por si la migration no corrio aun.
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
    console.warn("[site-settings bootstrap]", e instanceof Error ? e.message : e);
  }
}

const KEY_RE = /^[a-z][a-z0-9_]{1,63}$/;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await ctx.params;
    if (!KEY_RE.test(key)) return NextResponse.json({ error: "key invalida" }, { status: 400 });

    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    await ensureTable(pool);

    const r = await queryWithRetry<{ value: string | null; updated_at: string }>(
      pool,
      `SELECT value, updated_at::text AS updated_at
         FROM "alquiloya"."site_settings"
        WHERE empresa_id = $1::uuid AND key = $2
        LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, key]
    );
    return NextResponse.json({
      success: true,
      key,
      value: r.rows[0]?.value ?? null,
      updated_at: r.rows[0]?.updated_at ?? null,
    });
  } catch (err) {
    console.error("[site-settings GET]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await ctx.params;
    if (!KEY_RE.test(key)) return NextResponse.json({ error: "key invalida" }, { status: 400 });

    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { value?: string | null };
    const value = typeof body.value === "string" ? body.value.slice(0, 100_000) : null;

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    await ensureTable(pool);

    await queryWithRetry(
      pool,
      `INSERT INTO "alquiloya"."site_settings" (empresa_id, key, value)
       VALUES ($1::uuid, $2, $3)
       ON CONFLICT (empresa_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [ALQUILOYA_EMPRESA_ID, key, value]
    );
    return NextResponse.json({ success: true, key, value });
  } catch (err) {
    console.error("[site-settings PUT]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
