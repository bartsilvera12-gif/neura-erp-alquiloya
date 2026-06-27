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
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
function b(v: unknown, def: boolean): boolean {
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

type PatchBody = {
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

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    await ensureBillingNoteColumn(pool);

    const body = (await request.json().catch(() => ({}))) as PatchBody;
    const nombre = s(body.nombre);
    const tier = s(body.tier);
    if (!nombre) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });
    if (!tier) return NextResponse.json({ error: "tier requerido" }, { status: 400 });

    const upd = await queryWithRetry(
      pool,
      `UPDATE "alquiloya"."planes_publicacion" SET
         tier = $1,
         target = $2,
         nombre = $3,
         precio = COALESCE($4, 0),
         moneda = COALESCE($5, moneda),
         billing = COALESCE($6, billing),
         badge = $7,
         bullets = COALESCE($8::jsonb, '[]'::jsonb),
         excluded = COALESCE($9::jsonb, '[]'::jsonb),
         cta = $10,
         highlighted = $11,
         free_boosts = $12,
         orden = COALESCE($13, orden),
         activo = $14,
         billing_note = $15,
         updated_at = now()
       WHERE id = $16::uuid AND empresa_id = $17::uuid
       RETURNING id, tier, target, nombre,
                 precio::float8 AS precio, moneda, billing, badge,
                 COALESCE(bullets, '[]'::jsonb)  AS bullets,
                 COALESCE(excluded, '[]'::jsonb) AS excluded,
                 cta, highlighted, free_boosts, orden, activo, billing_note`,
      [
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
        b(body.highlighted, false),
        i(body.free_boosts),
        i(body.orden),
        b(body.activo, true),
        s(body.billing_note),
        id,
        ALQUILOYA_EMPRESA_ID,
      ]
    );

    if (!upd.rows[0]) {
      return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, plan: upd.rows[0] });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-planes-publicacion/[id] PATCH]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    await ensureBillingNoteColumn(pool);

    const r = await queryWithRetry(
      pool,
      `DELETE FROM "alquiloya"."planes_publicacion"
        WHERE id = $1::uuid
          AND NOT EXISTS (
            SELECT 1 FROM "alquiloya"."propietarios"
             WHERE plan_publicacion_id = $1::uuid
          )
          AND NOT EXISTS (
            SELECT 1 FROM "alquiloya"."agentes"
             WHERE plan_publicacion_id = $1::uuid
          )
        RETURNING id`,
      [id]
    );
    if (r.rows.length === 0) {
      return NextResponse.json(
        { error: "El plan tiene propietarios o agentes asignados. Desactivalo en lugar de borrarlo." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("[planes-publicacion/[id] DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
