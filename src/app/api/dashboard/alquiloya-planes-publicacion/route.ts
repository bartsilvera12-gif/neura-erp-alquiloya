import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let bootstrapped = false;
async function ensureBillingNoteColumn(pool: ReturnType<typeof getChatPostgresPool>) {
  if (bootstrapped || !pool) return;
  try {
    await queryWithRetry(
      pool,
      `ALTER TABLE "alquiloya"."planes_publicacion"
         ADD COLUMN IF NOT EXISTS billing_note text`,
      []
    );
    bootstrapped = true;
  } catch (e) {
    console.warn("[planes-publicacion bootstrap]", e instanceof Error ? e.message : e);
  }
}


const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function i(v: unknown): number | null {
  const x = n(v);
  return x == null ? null : Math.trunc(x);
}
function bo(v: unknown, def: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return def;
}
function arrText(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0);
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    await ensureBillingNoteColumn(pool);

    const { rows } = await queryWithRetry(
      pool,
      `SELECT id, tier, target, nombre,
              precio::float8 AS precio, moneda, billing, badge,
              COALESCE(bullets, '[]'::jsonb)  AS bullets,
              COALESCE(excluded, '[]'::jsonb) AS excluded,
              cta, highlighted, free_boosts, orden, activo, billing_note
         FROM "alquiloya"."planes_publicacion"
         WHERE empresa_id = $1::uuid
         ORDER BY orden ASC, nombre ASC`,
      [ALQUILOYA_EMPRESA_ID]
    );
    return NextResponse.json({ success: true, data: { planes: rows } });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-planes-publicacion GET]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

type PostBody = {
  tier?: string;
  target?: string | null;
  nombre?: string;
  precio?: number | string | null;
  moneda?: string;
  billing?: string;
  badge?: string | null;
  bullets?: unknown;
  excluded?: unknown;
  cta?: string | null;
  highlighted?: boolean;
  free_boosts?: number | string | null;
  billing_note?: string | null;
  orden?: number | string;
  activo?: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    await ensureBillingNoteColumn(pool);

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const nombre = s(body.nombre);
    const tier = s(body.tier);
    if (!nombre) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });
    if (!tier) return NextResponse.json({ error: "tier requerido" }, { status: 400 });

    const ins = await queryWithRetry(
      pool,
      `INSERT INTO "alquiloya"."planes_publicacion"
         (empresa_id, tier, target, nombre, precio, moneda, billing, badge,
          bullets, excluded, cta, highlighted, free_boosts, orden, activo, billing_note)
       VALUES
         ($1::uuid, $2, $3, $4, COALESCE($5, 0), COALESCE($6, 'PYG'), COALESCE($7, 'unico'),
          $8, COALESCE($9::jsonb, '[]'::jsonb), COALESCE($10::jsonb, '[]'::jsonb),
          $11, $12, $13, COALESCE($14, 0), $15, $16)
       RETURNING id, tier, target, nombre,
                 precio::float8 AS precio, moneda, billing, badge,
                 COALESCE(bullets, '[]'::jsonb)  AS bullets,
                 COALESCE(excluded, '[]'::jsonb) AS excluded,
                 cta, highlighted, free_boosts, orden, activo, billing_note`,
      [
        ALQUILOYA_EMPRESA_ID,
        tier,
        s(body.target),
        nombre,
        n(body.precio),
        s(body.moneda),
        s(body.billing),
        s(body.badge),
        JSON.stringify(arrText(body.bullets)),
        JSON.stringify(arrText(body.excluded)),
        s(body.cta),
        bo(body.highlighted, false),
        i(body.free_boosts),
        i(body.orden),
        bo(body.activo, true),
        s(body.billing_note),
      ]
    );

    return NextResponse.json({ success: true, plan: ins.rows[0] });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    console.error(
      "[api/dashboard/alquiloya-planes-publicacion POST]",
      "code=" + code,
      err instanceof Error ? err.message : err
    );
    let userMsg = "Error al crear plan";
    if (code === "23505") userMsg = "Ya existe un plan con ese tier. Cambialo y volve a intentar.";
    else if (code === "23502") userMsg = "Falta un dato requerido.";
    else if (code === "23514") userMsg = "Valor invalido en algun campo (billing/moneda).";
    return NextResponse.json({ error: userMsg + (code ? ` (codigo ${code})` : "") }, { status: 500 });
  }
}
