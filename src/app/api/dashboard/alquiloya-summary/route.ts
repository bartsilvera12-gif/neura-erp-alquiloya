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

// Cache de existencia de tablas/columnas a nivel de modulo. Persiste mientras el
// proceso Next.js esté vivo. Una migration nueva requiere restart (cold start),
// que ya ocurre tras cada deploy de Coolify. Esto evita 6+ queries por request.
const tableExistsCache = new Map<string, boolean>();
const colExistsCache = new Map<string, boolean>();

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

    // Helper: chequea si una tabla existe. Cacheado en módulo (1 query/proceso/tabla).
    const tableExists = async (name: string): Promise<boolean> => {
      const cached = tableExistsCache.get(name);
      if (cached !== undefined) return cached;
      const { rows } = await queryWithRetry<{ ok: boolean }>(
        pool,
        `SELECT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname='alquiloya' AND c.relname=$1 AND c.relkind='r'
        ) AS ok`,
        [name]
      );
      const ok = rows[0]?.ok === true;
      tableExistsCache.set(name, ok);
      return ok;
    };
    const colExists = async (table: string, col: string): Promise<boolean> => {
      const key = `${table}.${col}`;
      const cached = colExistsCache.get(key);
      if (cached !== undefined) return cached;
      const { rows } = await queryWithRetry<{ ok: boolean }>(
        pool,
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='alquiloya' AND table_name=$1 AND column_name=$2
        ) AS ok`,
        [table, col]
      );
      const ok = rows[0]?.ok === true;
      colExistsCache.set(key, ok);
      return ok;
    };
    const safeCount = async (sql: string): Promise<number> => {
      try {
        const { rows } = await queryWithRetry<{ n: number }>(pool, sql, [ALQUILOYA_EMPRESA_ID]);
        return rows[0]?.n ?? 0;
      } catch {
        return 0;
      }
    };

    const [
      totales, porTipo, porCiudad, agentesActivos, ultimas, consultas,
      hasSolAcceso, hasSolServicio, hasResenas, hasCaptaciones,
      hasPlanVencProp, hasPlanVencAg, hasPlanProp,
    ] = await Promise.all([
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
      tableExists("solicitudes_acceso"),
      tableExists("solicitudes_servicio"),
      tableExists("agente_resenas"),
      tableExists("agente_captaciones"),
      colExists("propietarios", "plan_vencimiento_at"),
      colExists("agentes", "plan_vencimiento_at"),
      colExists("propietarios", "plan_publicacion_id"),
    ]);

    // Segunda fase: TODAS en paralelo. Antes eran 9 awaits seriales (~450ms).
    // Cada safeCount ya hace try/catch internamente, asi que no rompe el Promise.all.
    const porPlanPromise: Promise<{ label: string; value: number }[]> = hasPlanProp
      ? queryWithRetry<{ label: string; value: number }>(
          pool,
          `SELECT COALESCE(pp.nombre, 'Sin plan') AS label, count(*)::int AS value
             FROM ${t("propietarios")} p
             LEFT JOIN ${t("planes_publicacion")} pp
               ON pp.empresa_id=p.empresa_id AND pp.id=p.plan_publicacion_id
            WHERE p.empresa_id=$1::uuid AND p.activo=true
            GROUP BY 1 ORDER BY value DESC, label ASC`,
          [ALQUILOYA_EMPRESA_ID]
        ).then((r) => r.rows).catch(() => [])
      : Promise.resolve([]);

    const [
      solAccesoPend, solServicioPend, resenasPend, captacionesPend,
      venc7Prop, venc7Ag, venc30Prop, venc30Ag, vencidosProp, vencidosAg,
      porPlan,
    ] = await Promise.all([
      hasSolAcceso ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("solicitudes_acceso")}
          WHERE empresa_id=$1::uuid AND estado='pendiente'`
      ) : Promise.resolve(0),
      hasSolServicio ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("solicitudes_servicio")}
          WHERE empresa_id=$1::uuid AND estado='pendiente'`
      ) : Promise.resolve(0),
      hasResenas ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("agente_resenas")}
          WHERE empresa_id=$1::uuid AND estado='pendiente'`
      ) : Promise.resolve(0),
      hasCaptaciones ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("agente_captaciones")}
          WHERE empresa_id=$1::uuid AND COALESCE(estado,'') NOT IN ('cerrada','finalizada','descartada')`
      ) : Promise.resolve(0),
      hasPlanVencProp ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("propietarios")}
          WHERE empresa_id=$1::uuid AND activo=true
            AND plan_vencimiento_at IS NOT NULL
            AND plan_vencimiento_at BETWEEN now() AND now() + interval '7 days'`
      ) : Promise.resolve(0),
      hasPlanVencAg ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("agentes")}
          WHERE empresa_id=$1::uuid AND activo=true
            AND plan_vencimiento_at IS NOT NULL
            AND plan_vencimiento_at BETWEEN now() AND now() + interval '7 days'`
      ) : Promise.resolve(0),
      hasPlanVencProp ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("propietarios")}
          WHERE empresa_id=$1::uuid AND activo=true
            AND plan_vencimiento_at IS NOT NULL
            AND plan_vencimiento_at BETWEEN now() AND now() + interval '30 days'`
      ) : Promise.resolve(0),
      hasPlanVencAg ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("agentes")}
          WHERE empresa_id=$1::uuid AND activo=true
            AND plan_vencimiento_at IS NOT NULL
            AND plan_vencimiento_at BETWEEN now() AND now() + interval '30 days'`
      ) : Promise.resolve(0),
      hasPlanVencProp ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("propietarios")}
          WHERE empresa_id=$1::uuid AND activo=true
            AND plan_vencimiento_at IS NOT NULL AND plan_vencimiento_at < now()`
      ) : Promise.resolve(0),
      hasPlanVencAg ? safeCount(
        `SELECT count(*)::int AS n FROM ${t("agentes")}
          WHERE empresa_id=$1::uuid AND activo=true
            AND plan_vencimiento_at IS NOT NULL AND plan_vencimiento_at < now()`
      ) : Promise.resolve(0),
      porPlanPromise,
    ]);

    return NextResponse.json({
      success: true,
      data: {
        propiedades: totales.rows[0] ?? { total: 0, activas: 0, publicadas: 0, destacadas: 0 },
        por_tipo: porTipo.rows,
        por_ciudad: porCiudad.rows,
        por_plan: porPlan,
        agentes: agentesActivos.rows[0] ?? { activos: 0, total: 0 },
        consultas: consultas.rows[0] ?? { total: 0, ultimas_30: 0, pendientes: 0 },
        ultimas: ultimas.rows,
        acciones_pendientes: {
          solicitudes_acceso: solAccesoPend,
          solicitudes_servicio: solServicioPend,
          agente_resenas: resenasPend,
          captaciones: captacionesPend,
        },
        planes: {
          por_vencer_7d: venc7Prop + venc7Ag,
          por_vencer_30d: venc30Prop + venc30Ag,
          vencidos: vencidosProp + vencidosAg,
        },
      },
    });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-summary]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error al cargar resumen" }, { status: 500 });
  }
}
