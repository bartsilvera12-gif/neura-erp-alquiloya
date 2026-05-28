import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

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
    if (!user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const pool = getChatPostgresPool();
    if (!pool) {
      return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    }

    const [totales, porTipo, porCiudad, agentesActivos, ultimas, consultas] = await Promise.all([
      queryWithRetry<{
        total: number;
        activas: number;
        publicadas: number;
        destacadas: number;
      }>(
        pool,
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE activo = true)::int AS activas,
           count(*) FILTER (WHERE activo = true AND visible_web = true)::int AS publicadas,
           count(*) FILTER (WHERE destacada = true)::int AS destacadas
         FROM ${t("propiedades")} WHERE empresa_id = $1::uuid`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ label: string; value: number }>(
        pool,
        `SELECT COALESCE(NULLIF(trim(tipo), ''), 'Sin tipo') AS label, count(*)::int AS value
         FROM ${t("propiedades")} WHERE empresa_id = $1::uuid
         GROUP BY 1 ORDER BY value DESC, label ASC LIMIT 12`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ label: string; value: number }>(
        pool,
        `SELECT COALESCE(NULLIF(trim(ciudad), ''), 'Sin ciudad') AS label, count(*)::int AS value
         FROM ${t("propiedades")} WHERE empresa_id = $1::uuid
         GROUP BY 1 ORDER BY value DESC, label ASC LIMIT 12`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ activos: number; total: number }>(
        pool,
        `SELECT
           count(*) FILTER (WHERE activo = true)::int AS activos,
           count(*)::int AS total
         FROM ${t("agentes")} WHERE empresa_id = $1::uuid`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{
        id: string;
        titulo: string | null;
        tipo: string | null;
        ciudad: string | null;
        precio: number | null;
        moneda: string | null;
        cover_url: string | null;
        created_at: string;
        agente_nombre: string | null;
      }>(
        pool,
        `SELECT p.id, p.titulo, p.tipo, p.ciudad,
                p.precio::float8 AS precio, p.moneda,
                cover.url AS cover_url,
                p.created_at::text AS created_at,
                a.nombre AS agente_nombre
         FROM ${t("propiedades")} p
         LEFT JOIN ${t("agentes")} a ON a.id = p.agente_id AND a.empresa_id = p.empresa_id
         LEFT JOIN LATERAL (
           SELECT pf.url FROM ${t("propiedad_fotos")} pf
           WHERE pf.empresa_id = p.empresa_id AND pf.propiedad_id = p.id AND pf.activo = true
           ORDER BY pf.es_portada DESC, pf.orden ASC, pf.created_at ASC, pf.id ASC LIMIT 1
         ) cover ON true
         WHERE p.empresa_id = $1::uuid
         ORDER BY p.created_at DESC NULLS LAST
         LIMIT 6`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{
        total: number;
        ultimas_30: number;
        pendientes: number;
      }>(
        pool,
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS ultimas_30,
           count(*) FILTER (WHERE COALESCE(estado, '') NOT IN ('cerrada','atendida','descartada'))::int AS pendientes
         FROM ${t("consultas_propiedad")} WHERE empresa_id = $1::uuid AND activo = true`,
        [ALQUILOYA_EMPRESA_ID]
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        propiedades: totales.rows[0] ?? { total: 0, activas: 0, publicadas: 0, destacadas: 0 },
        por_tipo: porTipo.rows,
        por_ciudad: porCiudad.rows,
        agentes: agentesActivos.rows[0] ?? { activos: 0, total: 0 },
        consultas: consultas.rows[0] ?? { total: 0, ultimas_30: 0, pendientes: 0 },
        ultimas: ultimas.rows,
      },
    });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-summary]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error al cargar resumen" }, { status: 500 });
  }
}
