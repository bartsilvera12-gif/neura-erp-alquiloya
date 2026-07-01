import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}
let bootstrapped = false;
async function ensureExtraColumns(pool: NonNullable<ReturnType<typeof getChatPostgresPool>>) {
  if (bootstrapped) return;
  try {
    await queryWithRetry(pool, `ALTER TABLE "alquiloya"."propiedades" ADD COLUMN IF NOT EXISTS vistas_count integer NOT NULL DEFAULT 0`, []);
    await queryWithRetry(pool, `ALTER TABLE "alquiloya"."propiedades" ADD COLUMN IF NOT EXISTS ultima_vista_at timestamptz`, []);
    await queryWithRetry(pool, `ALTER TABLE "alquiloya"."propiedades" ADD COLUMN IF NOT EXISTS video_url text`, []);
    await queryWithRetry(pool, `ALTER TABLE "alquiloya"."propiedades" ADD COLUMN IF NOT EXISTS clicks_whatsapp integer NOT NULL DEFAULT 0`, []);
    bootstrapped = true;
  } catch (e) {
    console.warn("[agente/propiedades bootstrap]", e instanceof Error ? e.message : e);
  }
}


type PropiedadAgenteRow = {
  id: string;
  codigo: string | null;
  titulo: string | null;
  descripcion: string | null;
  tipo: string | null;
  operacion: string | null;
  estado: string | null;
  ciudad: string | null;
  barrio: string | null;
  direccion: string | null;
  precio: number | null;
  moneda: string | null;
  dormitorios: number | null;
  banos: number | null;
  cocheras: number | null;
  superficie_m2: number | null;
  lat: number | null;
  lng: number | null;
  destacada: boolean | null;
  visible_web: boolean | null;
  activo: boolean | null;
  cover_url: string | null;
  vistas_count: number;
  clicks_whatsapp: number;
  ultima_vista_at: string | null;
  video_url: string | null;
  fotos_count: number;
  created_at: string | null;
  plan_es_gratis: boolean | null;
  plan_gratis_dias_restantes: number | null;
  plan_gratis_expirado: boolean | null;
};

/**
 * GET /api/agente/propiedades
 *
 * Devuelve las propiedades del agente vinculado al usuario autenticado.
 * Si el usuario no tiene `agente_id` asignado, devuelve lista vacía con
 * `agente: null`. La consulta no aplica el filtro `visible_web/activo`
 * porque el panel del agente debe ver también sus borradores/pausadas.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no resuelto" }, { status: 404 });
    }

    const { data: uExt } = await supabase
      .from("usuarios")
      .select("agente_id")
      .eq("id", usuario.id)
      .limit(1)
      .maybeSingle();
    const agenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;

    if (!agenteId) {
      return NextResponse.json({
        success: true,
        agente: null,
        propiedades: [],
      });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    await ensureExtraColumns(pool);

    const { rows } = await queryWithRetry<PropiedadAgenteRow>(
      pool,
      `
        SELECT
          p.id, p.codigo, p.titulo, p.descripcion,
          p.tipo, p.operacion, p.estado,
          p.ciudad, p.barrio, p.direccion,
          p.precio::float8 AS precio, p.moneda,
          p.dormitorios, p.banos, p.cocheras,
          p.superficie_m2::float8 AS superficie_m2,
          p.lat::float8 AS lat, p.lng::float8 AS lng,
          p.destacada, p.visible_web, p.activo,
          COALESCE(p.vistas_count, 0)::int AS vistas_count,
          COALESCE(p.clicks_whatsapp, 0)::int AS clicks_whatsapp,
          p.ultima_vista_at::text AS ultima_vista_at,
          p.video_url,
          cover.url AS cover_url,
          COALESCE(fcnt.n, 0)::int AS fotos_count,
          p.created_at::text AS created_at,
          (pp.billing = 'gratis' OR pp.tier ILIKE 'gratuito%') AS plan_es_gratis,
          GREATEST(0, 30 - EXTRACT(DAY FROM (now() - p.created_at))::int) AS plan_gratis_dias_restantes,
          (
            (pp.billing = 'gratis' OR pp.tier ILIKE 'gratuito%')
            AND p.created_at < now() - interval '30 days'
          ) AS plan_gratis_expirado
        FROM ${t("propiedades")} p
        LEFT JOIN ${t("propietarios")} pr ON pr.id = p.propietario_id
        LEFT JOIN ${t("planes_publicacion")} pp ON pp.id = pr.plan_publicacion_id
        LEFT JOIN LATERAL (
          SELECT pf.url FROM ${t("propiedad_fotos")} pf
          WHERE pf.empresa_id = p.empresa_id
            AND pf.propiedad_id = p.id
            AND pf.activo = true
          ORDER BY pf.es_portada DESC, pf.orden ASC, pf.created_at ASC, pf.id ASC
          LIMIT 1
        ) cover ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS n FROM ${t("propiedad_fotos")} pf
          WHERE pf.empresa_id = p.empresa_id
            AND pf.propiedad_id = p.id
            AND pf.activo = true
        ) fcnt ON true
        WHERE p.empresa_id = $1::uuid AND p.agente_id = $2::uuid
          AND COALESCE(p.estado, '') NOT IN ('rechazada','eliminada')
        ORDER BY p.destacada DESC NULLS LAST, p.created_at DESC NULLS LAST, p.titulo ASC
      `,
      [ALQUILOYA_EMPRESA_ID, agenteId]
    );

    return NextResponse.json({
      success: true,
      agente: { id: agenteId },
      propiedades: rows ?? [],
    });
  } catch (err) {
    console.error("[api/agente/propiedades]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
