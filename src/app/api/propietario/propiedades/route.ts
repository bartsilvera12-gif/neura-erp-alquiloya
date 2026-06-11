import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no autorizado" }, { status: 403 });
    }
    const { data: uExt } = await supabase
      .from("usuarios")
      .select("propietario_id")
      .eq("id", usuario.id)
      .limit(1)
      .maybeSingle();
    const propietarioId = (uExt as { propietario_id?: string | null } | null)?.propietario_id ?? null;
    if (!propietarioId) {
      return NextResponse.json({ success: true, propiedades: [] });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const { rows } = await queryWithRetry(
      pool,
      `SELECT
         p.id, p.codigo, p.titulo, p.tipo, p.operacion, p.estado,
         p.ciudad, p.barrio,
         p.lat::float8 AS lat, p.lng::float8 AS lng,
         p.precio::float8 AS precio, p.moneda,
         p.dormitorios, p.banos,
         (p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now())) AS destacada,
         p.destacada_hasta::text AS destacada_hasta,
         p.visible_web, p.activo,
         p.created_at::text AS created_at,
         cover.url AS cover_url,
         COALESCE(fcnt.n, 0)::int AS fotos_count,
         -- Info plan gratis: para que el panel del propietario muestre el banner
         -- "tu plan gratis vence en X dias / vencio, compra un plan".
         (pp.billing = 'gratis' OR pp.tier ILIKE 'gratuito%') AS plan_es_gratis,
         GREATEST(
           0,
           30 - EXTRACT(DAY FROM (now() - p.created_at))::int
         ) AS plan_gratis_dias_restantes,
         (
           (pp.billing = 'gratis' OR pp.tier ILIKE 'gratuito%')
           AND p.created_at < now() - interval '30 days'
         ) AS plan_gratis_expirado
       FROM ${t("propiedades")} p
       LEFT JOIN ${t("propietarios")} pr ON pr.id = p.propietario_id
       LEFT JOIN ${t("planes_publicacion")} pp ON pp.id = pr.plan_publicacion_id
       LEFT JOIN LATERAL (
         SELECT pf.url
         FROM ${t("propiedad_fotos")} pf
         WHERE pf.empresa_id = p.empresa_id AND pf.propiedad_id = p.id AND pf.activo = true
         ORDER BY pf.es_portada DESC, pf.orden ASC, pf.created_at ASC, pf.id ASC
         LIMIT 1
       ) cover ON true
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS n
         FROM ${t("propiedad_fotos")} pf
         WHERE pf.empresa_id = p.empresa_id AND pf.propiedad_id = p.id AND pf.activo = true
       ) fcnt ON true
       WHERE p.empresa_id = $1::uuid AND p.propietario_id = $2::uuid
       ORDER BY (p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now())) DESC,
                p.created_at DESC NULLS LAST`,
      [ALQUILOYA_EMPRESA_ID, propietarioId]
    );
    return NextResponse.json({ success: true, propiedades: rows ?? [] });
  } catch (err) {
    console.error("[api/propietario/propiedades]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
