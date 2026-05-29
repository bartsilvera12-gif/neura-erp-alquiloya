import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function t(table: string): string {
  return `"${SCHEMA}"."${table}"`;
}
function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length > 0 ? x : null;
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
function slugify(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type PartnerRow = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  tipo: string | null;
  activo: boolean;
  created_at: string | null;
  primary_link_id: string | null;
  primary_slug: string | null;
  primary_campania: string | null;
  primary_cookie_dias: number | null;
  rule_id: string | null;
  rule_tipo: string | null;
  rule_valor: number | null;
  rule_moneda: string | null;
  rule_recurrente: boolean | null;
  rule_meses_recurrencia: number | null;
  links_count: number;
  clicks_count: number;
  conversiones_count: number;
  comision_pendiente: number;
};

export async function GET() {
  try {
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    const { rows } = await queryWithRetry<PartnerRow>(
      pool,
      `
        SELECT
          p.id, p.nombre, p.email, p.telefono, p.tipo, p.activo,
          p.created_at::text AS created_at,
          lk.id   AS primary_link_id,
          lk.slug AS primary_slug,
          lk.campania AS primary_campania,
          lk.cookie_dias AS primary_cookie_dias,
          r.id   AS rule_id,
          r.tipo AS rule_tipo,
          r.valor::float8 AS rule_valor,
          r.moneda AS rule_moneda,
          r.recurrente AS rule_recurrente,
          r.meses_recurrencia AS rule_meses_recurrencia,
          COALESCE(lc.n, 0)::int AS links_count,
          COALESCE(cc.n, 0)::int AS clicks_count,
          COALESCE(cv.n, 0)::int AS conversiones_count,
          COALESCE(cm.s, 0)::float8 AS comision_pendiente
        FROM ${t("referral_partners")} p
        LEFT JOIN LATERAL (
          SELECT id, slug, campania, cookie_dias
            FROM ${t("referral_links")}
           WHERE partner_id = p.id
           ORDER BY activo DESC, created_at ASC
           LIMIT 1
        ) lk ON true
        LEFT JOIN LATERAL (
          SELECT id, tipo, valor, moneda, recurrente, meses_recurrencia
            FROM ${t("referral_commission_rules")}
           WHERE partner_id = p.id AND vigente_hasta IS NULL
           ORDER BY vigente_desde DESC
           LIMIT 1
        ) r ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS n FROM ${t("referral_links")}
           WHERE partner_id = p.id AND activo = true
        ) lc ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS n FROM ${t("referral_clicks")}
           WHERE empresa_id = p.empresa_id
             AND link_id IN (SELECT id FROM ${t("referral_links")} WHERE partner_id = p.id)
        ) cc ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS n FROM ${t("referral_conversions")}
           WHERE partner_id = p.id
        ) cv ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(sum(monto_comision),0) AS s FROM ${t("referral_commissions")}
           WHERE partner_id = p.id AND estado = 'pendiente'
        ) cm ON true
        WHERE p.empresa_id = $1::uuid
        ORDER BY p.created_at DESC NULLS LAST, lower(p.nombre) ASC
      `,
      [ALQUILOYA_EMPRESA_ID]
    );
    return NextResponse.json({ success: true, data: rows ?? [] });
  } catch (err) {
    console.error("[api alquiloya-referral-partners GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

type PostBody = {
  nombre?: string;
  email?: string | null;
  telefono?: string | null;
  tipo?: string | null;
  notas?: string | null;
  activo?: boolean;
  slug?: string;
  campania?: string | null;
  cookie_dias?: number | string | null;
  rule_tipo?: "porcentaje" | "monto_fijo";
  rule_valor?: number | string;
  rule_moneda?: string | null;
  rule_recurrente?: boolean;
  rule_meses_recurrencia?: number | string | null;
};

const TIPOS_PARTNER = new Set(["influencer", "aliado", "agente_referido", "otro"]);
const TIPOS_RULE = new Set(["porcentaje", "monto_fijo"]);

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as PostBody;

    const nombre = s(body.nombre);
    if (!nombre) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });

    const tipo = s(body.tipo);
    if (tipo && !TIPOS_PARTNER.has(tipo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    const slugRawProvided = s(body.slug);
    const slug = slugify(slugRawProvided ?? nombre);
    if (!slug) return NextResponse.json({ error: "slug inválido" }, { status: 400 });

    const cookieDias = i(body.cookie_dias) ?? 60;
    if (cookieDias < 1 || cookieDias > 365) {
      return NextResponse.json({ error: "cookie_dias fuera de rango (1–365)" }, { status: 400 });
    }

    const ruleTipo = s(body.rule_tipo);
    if (!ruleTipo || !TIPOS_RULE.has(ruleTipo)) {
      return NextResponse.json({ error: "rule_tipo inválido" }, { status: 400 });
    }
    const ruleValor = n(body.rule_valor);
    if (ruleValor == null || ruleValor < 0) {
      return NextResponse.json({ error: "rule_valor inválido" }, { status: 400 });
    }
    if (ruleTipo === "porcentaje" && ruleValor > 100) {
      return NextResponse.json({ error: "porcentaje > 100" }, { status: 400 });
    }
    const ruleMoneda = s(body.rule_moneda);
    if (ruleTipo === "monto_fijo" && !ruleMoneda) {
      return NextResponse.json({ error: "moneda requerida para monto_fijo" }, { status: 400 });
    }
    const recurrente = b(body.rule_recurrente, false);
    let meses: number | null = i(body.rule_meses_recurrencia);
    if (recurrente) {
      if (!meses || meses < 1 || meses > 60) {
        return NextResponse.json({ error: "meses_recurrencia fuera de rango (1–60)" }, { status: 400 });
      }
    } else {
      meses = null;
    }

    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");

      // Validar slug único antes de inserts (mejor mensaje que UNIQUE violation)
      const slugCheck = await client.query(
        `SELECT 1 FROM ${t("referral_links")}
          WHERE empresa_id = $1::uuid AND lower(slug) = lower($2) LIMIT 1`,
        [ALQUILOYA_EMPRESA_ID, slug]
      );
      if (slugCheck.rowCount && slugCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `El slug "${slug}" ya está en uso.` },
          { status: 409 }
        );
      }

      const insP = await client.query<{ id: string }>(
        `INSERT INTO ${t("referral_partners")} (
           empresa_id, nombre, email, telefono, tipo, notas, activo
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          ALQUILOYA_EMPRESA_ID,
          nombre,
          s(body.email),
          s(body.telefono),
          tipo,
          s(body.notas),
          b(body.activo, true),
        ]
      );
      const partnerId = insP.rows[0].id;

      const insL = await client.query<{ id: string }>(
        `INSERT INTO ${t("referral_links")} (
           empresa_id, partner_id, slug, campania, cookie_dias, activo
         ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, true)
         RETURNING id`,
        [
          ALQUILOYA_EMPRESA_ID,
          partnerId,
          slug,
          s(body.campania),
          cookieDias,
        ]
      );
      const linkId = insL.rows[0].id;

      const insR = await client.query<{ id: string }>(
        `INSERT INTO ${t("referral_commission_rules")} (
           empresa_id, partner_id, link_id, tipo, valor, moneda,
           recurrente, meses_recurrencia, vigente_desde
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, now())
         RETURNING id`,
        [
          ALQUILOYA_EMPRESA_ID,
          partnerId,
          linkId,
          ruleTipo,
          ruleValor,
          ruleTipo === "porcentaje" ? null : ruleMoneda,
          recurrente,
          meses,
        ]
      );

      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        id: partnerId,
        link_id: linkId,
        rule_id: insR.rows[0].id,
        slug,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api alquiloya-referral-partners POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
