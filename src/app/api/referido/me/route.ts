import { NextResponse } from "next/server";
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

/**
 * GET /api/referido/me
 *
 * Resuelve la sesión Supabase a un referral_partner via:
 *   auth.users → alquiloya.usuarios (auth_user_id) → referral_partners (usuario_id)
 *
 * Responses:
 *   200 { partner, links[], stats, commissions[] }
 *   401 si no hay sesión
 *   403 si la cuenta no está vinculada a ningún partner
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const pool = getChatPostgresPool();
    if (!pool) {
      return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    }

    // 1. usuario ERP
    const u = await queryWithRetry<{ id: string; rol: string | null }>(
      pool,
      `SELECT id, rol FROM ${t("usuarios")}
        WHERE auth_user_id = $1::uuid AND empresa_id = $2::uuid
        LIMIT 1`,
      [user.id, ALQUILOYA_EMPRESA_ID]
    );
    if (!u.rows || u.rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no vinculado a AlquiloYa" },
        { status: 403 }
      );
    }
    const usuarioErpId = u.rows[0].id;

    // 2. partner por usuario_id
    const p = await queryWithRetry<{
      id: string;
      nombre: string;
      email: string | null;
      telefono: string | null;
      tipo: string | null;
      activo: boolean;
    }>(
      pool,
      `SELECT id, nombre, email, telefono, tipo, activo
         FROM ${t("referral_partners")}
        WHERE empresa_id = $1::uuid AND usuario_id = $2::uuid AND activo = true
        LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, usuarioErpId]
    );
    if (!p.rows || p.rows.length === 0) {
      return NextResponse.json(
        { error: "Esta cuenta no está vinculada a un referido." },
        { status: 403 }
      );
    }
    const partner = p.rows[0];

    // 3. links + regla vigente
    const links = await queryWithRetry(
      pool,
      `SELECT id, slug, campania, cookie_dias, activo
         FROM ${t("referral_links")}
        WHERE empresa_id = $1::uuid AND partner_id = $2::uuid
        ORDER BY activo DESC, created_at ASC`,
      [ALQUILOYA_EMPRESA_ID, partner.id]
    );
    const rule = await queryWithRetry(
      pool,
      `SELECT id, tipo, valor::float8 AS valor, moneda, recurrente, meses_recurrencia
         FROM ${t("referral_commission_rules")}
        WHERE empresa_id = $1::uuid AND partner_id = $2::uuid AND vigente_hasta IS NULL
        ORDER BY vigente_desde DESC LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, partner.id]
    );

    // 4. stats agregados
    const stats = await queryWithRetry<{
      clicks: number;
      conversiones: number;
      pendiente: string;
      pagada: string;
    }>(
      pool,
      `SELECT
         (SELECT count(*)::int FROM ${t("referral_clicks")}
           WHERE empresa_id=$1::uuid AND link_id IN (
             SELECT id FROM ${t("referral_links")} WHERE partner_id=$2::uuid
           )) AS clicks,
         (SELECT count(*)::int FROM ${t("referral_conversions")}
           WHERE empresa_id=$1::uuid AND partner_id=$2::uuid) AS conversiones,
         (SELECT COALESCE(sum(monto_comision),0)::text FROM ${t("referral_commissions")}
           WHERE empresa_id=$1::uuid AND partner_id=$2::uuid AND estado='pendiente') AS pendiente,
         (SELECT COALESCE(sum(monto_comision),0)::text FROM ${t("referral_commissions")}
           WHERE empresa_id=$1::uuid AND partner_id=$2::uuid AND estado='pagada') AS pagada`,
      [ALQUILOYA_EMPRESA_ID, partner.id]
    );
    const st = stats.rows[0];

    // 5. ultimas comisiones — incluye datos de la conversion para que el
    // portal pueda mostrar a quien corresponde cada comision, que plan
    // compro y de que campana vino.
    const comm = await queryWithRetry(
      pool,
      `SELECT c.id, c.periodo,
              c.monto_base::float8 AS monto_base,
              c.porcentaje_aplicado::float8 AS porcentaje_aplicado,
              c.monto_comision::float8 AS monto,
              c.moneda,
              c.estado, c.generada_at::text AS generada_at,
              c.pagada_at::text AS pagada_at,
              c.pago_referencia,
              cv.target_tipo AS conv_target_tipo,
              cv.converted_at::text AS conv_converted_at,
              COALESCE(u.nombre, pr.nombre, ag.nombre) AS referido_nombre,
              COALESCE(u.email,  pr.email,  ag.email)  AS referido_email,
              lk.campania AS fuente,
              pp.nombre AS plan_nombre,
              pp.tier   AS plan_tier
         FROM ${t("referral_commissions")} c
         LEFT JOIN ${t("referral_conversions")} cv
           ON cv.empresa_id = c.empresa_id AND cv.id = c.conversion_id
         LEFT JOIN ${t("referral_links")} lk
           ON lk.empresa_id = cv.empresa_id AND lk.id = cv.link_id
         LEFT JOIN ${t("planes_publicacion")} pp
           ON pp.empresa_id = cv.empresa_id AND pp.id = cv.plan_publicacion_id
         LEFT JOIN ${t("usuarios")} u
           ON u.empresa_id = cv.empresa_id AND u.id = cv.usuario_id
         LEFT JOIN ${t("propietarios")} pr
           ON pr.empresa_id = cv.empresa_id AND cv.target_tipo='propietario' AND pr.id = cv.target_id
         LEFT JOIN ${t("agentes")} ag
           ON ag.empresa_id = cv.empresa_id AND cv.target_tipo='agente' AND ag.id = cv.target_id
        WHERE c.empresa_id = $1::uuid AND c.partner_id = $2::uuid
        ORDER BY c.generada_at DESC LIMIT 50`,
      [ALQUILOYA_EMPRESA_ID, partner.id]
    );

    return NextResponse.json({
      success: true,
      partner,
      links: links.rows ?? [],
      rule: rule.rows?.[0] ?? null,
      stats: {
        clicks: st?.clicks ?? 0,
        conversiones: st?.conversiones ?? 0,
        comision_pendiente: Number(st?.pendiente ?? "0"),
        comision_pagada: Number(st?.pagada ?? "0"),
      },
      commissions: comm.rows ?? [],
    });
  } catch (err) {
    console.error("[api/referido/me GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
