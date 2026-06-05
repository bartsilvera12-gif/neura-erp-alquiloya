import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${SCHEMA}"."${table}"`;
}
function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length > 0 ? x : null;
}
function b(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

const TIPOS_PARTNER = new Set(["influencer", "aliado", "agente_referido", "otro"]);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const partner = await queryWithRetry(
      pool,
      `SELECT id, nombre, email, telefono, tipo, notas, activo,
              created_at::text AS created_at
         FROM ${t("referral_partners")}
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!partner.rows || partner.rows.length === 0) {
      return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    }

    const links = await queryWithRetry(
      pool,
      `SELECT id, slug, campania, cookie_dias, activo, created_at::text AS created_at
         FROM ${t("referral_links")}
        WHERE empresa_id=$1::uuid AND partner_id=$2::uuid
        ORDER BY activo DESC, created_at ASC`,
      [ALQUILOYA_EMPRESA_ID, id]
    );

    const rule = await queryWithRetry(
      pool,
      `SELECT id, tipo, valor::float8 AS valor, moneda, recurrente,
              meses_recurrencia, vigente_desde::text AS vigente_desde
         FROM ${t("referral_commission_rules")}
        WHERE empresa_id=$1::uuid AND partner_id=$2::uuid AND vigente_hasta IS NULL
        ORDER BY vigente_desde DESC LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );

    return NextResponse.json({
      success: true,
      data: {
        partner: partner.rows[0],
        links: links.rows,
        rule: rule.rows?.[0] ?? null,
      },
    });
  } catch (err) {
    console.error("[api alquiloya-referral-partners/[id] GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // Verificar actividad. Si hay clicks/conversiones/comisiones → soft delete (activo=false).
    const activity = await queryWithRetry<{
      clicks: number;
      conversiones: number;
      comisiones: number;
    }>(
      pool,
      `SELECT
         (SELECT count(*)::int FROM ${t("referral_clicks")}
           WHERE link_id IN (SELECT id FROM ${t("referral_links")} WHERE partner_id=$2::uuid))
         AS clicks,
         (SELECT count(*)::int FROM ${t("referral_conversions")} WHERE partner_id=$2::uuid) AS conversiones,
         (SELECT count(*)::int FROM ${t("referral_commissions")} WHERE partner_id=$2::uuid) AS comisiones
       FROM ${t("referral_partners")} p
        WHERE p.empresa_id=$1::uuid AND p.id=$2::uuid`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!activity.rows || activity.rows.length === 0) {
      return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    }
    const { clicks, conversiones, comisiones } = activity.rows[0];

    if (clicks > 0 || conversiones > 0 || comisiones > 0) {
      // Soft delete: marcar inactivo + desactivar links. Preserva historial.
      await queryWithRetry(
        pool,
        `UPDATE ${t("referral_partners")} SET activo=false
          WHERE empresa_id=$1::uuid AND id=$2::uuid`,
        [ALQUILOYA_EMPRESA_ID, id]
      );
      await queryWithRetry(
        pool,
        `UPDATE ${t("referral_links")} SET activo=false
          WHERE empresa_id=$1::uuid AND partner_id=$2::uuid AND activo=true`,
        [ALQUILOYA_EMPRESA_ID, id]
      );
      return NextResponse.json({
        success: true,
        mode: "soft",
        reason: `Tiene historial (clicks=${clicks}, conversiones=${conversiones}, comisiones=${comisiones}). Marcado inactivo en lugar de borrar.`,
      });
    }

    // Hard delete seguro: borra partner; CASCADE limpia links + reglas (FK ON DELETE CASCADE).
    const r = await queryWithRetry<{ id: string }>(
      pool,
      `DELETE FROM ${t("referral_partners")}
        WHERE empresa_id=$1::uuid AND id=$2::uuid
        RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!r.rows || r.rows.length === 0) {
      return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, mode: "hard" });
  } catch (err) {
    console.error("[api alquiloya-referral-partners/[id] DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    function push(col: string, val: unknown) {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    }
    if (typeof body.nombre === "string") {
      const v = s(body.nombre);
      if (!v) return NextResponse.json({ error: "nombre vacio" }, { status: 400 });
      push("nombre", v);
    }
    if ("email" in body) push("email", s(body.email));
    if ("telefono" in body) push("telefono", s(body.telefono));
    if ("notas" in body) push("notas", s(body.notas));
    if ("tipo" in body) {
      const v = s(body.tipo);
      if (v && !TIPOS_PARTNER.has(v)) {
        return NextResponse.json({ error: "tipo invalido" }, { status: 400 });
      }
      push("tipo", v);
    }
    if ("activo" in body) {
      const v = b(body.activo);
      if (v !== undefined) push("activo", v);
    }
    if (sets.length === 0) return NextResponse.json({ error: "sin cambios" }, { status: 400 });

    vals.push(ALQUILOYA_EMPRESA_ID);
    vals.push(id);
    const sql = `UPDATE ${t("referral_partners")} SET ${sets.join(", ")}
                  WHERE empresa_id=$${vals.length - 1}::uuid AND id=$${vals.length}::uuid
                  RETURNING id`;
    const r = await queryWithRetry<{ id: string }>(pool, sql, vals);
    if (!r.rows || r.rows.length === 0) {
      return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    }

    // Si se reactivo el partner, reactivamos tambien sus links. El soft-delete
    // previo dejaba ambos en activo=false; al reactivar el partner sin esto
    // el /r/{slug} seguia tirando 404 porque l.activo seguia en false.
    if ("activo" in body && b(body.activo) === true) {
      await queryWithRetry(
        pool,
        `UPDATE ${t("referral_links")} SET activo=true
          WHERE empresa_id=$1::uuid AND partner_id=$2::uuid AND activo=false`,
        [ALQUILOYA_EMPRESA_ID, id]
      );
    }

    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api alquiloya-referral-partners/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
