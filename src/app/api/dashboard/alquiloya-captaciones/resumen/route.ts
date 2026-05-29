import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // 1. Cards globales (counts por etapa + ventanas temporales)
    const cards = await queryWithRetry<{
      total: number;
      nuevo: number;
      contacto: number;
      negocio_activo: number;
      cerrado: number;
      rechazado: number;
      ult_7: number;
      ult_30: number;
    }>(
      pool,
      `SELECT
         count(*)::int                                                      AS total,
         count(*) FILTER (WHERE etapa='nuevo')::int                         AS nuevo,
         count(*) FILTER (WHERE etapa='contacto')::int                      AS contacto,
         count(*) FILTER (WHERE etapa='negocio_activo')::int                AS negocio_activo,
         count(*) FILTER (WHERE etapa='cerrado')::int                       AS cerrado,
         count(*) FILTER (WHERE etapa='rechazado')::int                     AS rechazado,
         count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int  AS ult_7,
         count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS ult_30
       FROM "alquiloya"."agente_captaciones"
       WHERE empresa_id = $1::uuid`,
      [ALQUILOYA_EMPRESA_ID]
    );
    const c = cards.rows[0] ?? {
      total: 0, nuevo: 0, contacto: 0, negocio_activo: 0,
      cerrado: 0, rechazado: 0, ult_7: 0, ult_30: 0,
    };
    const totalCerradoRechazado = c.cerrado + c.rechazado;
    const tasa_cierre = totalCerradoRechazado > 0
      ? Math.round((c.cerrado / totalCerradoRechazado) * 1000) / 10
      : 0;

    // 2. By agent
    const byAgent = await queryWithRetry<{
      agente_id: string;
      agente_nombre: string | null;
      total: number;
      nuevo: number;
      contacto: number;
      negocio_activo: number;
      cerrado: number;
      rechazado: number;
    }>(
      pool,
      `SELECT
         c.agente_id,
         a.nombre AS agente_nombre,
         count(*)::int                                       AS total,
         count(*) FILTER (WHERE c.etapa='nuevo')::int          AS nuevo,
         count(*) FILTER (WHERE c.etapa='contacto')::int       AS contacto,
         count(*) FILTER (WHERE c.etapa='negocio_activo')::int AS negocio_activo,
         count(*) FILTER (WHERE c.etapa='cerrado')::int        AS cerrado,
         count(*) FILTER (WHERE c.etapa='rechazado')::int      AS rechazado
       FROM "alquiloya"."agente_captaciones" c
       LEFT JOIN "alquiloya"."agentes" a
         ON a.id = c.agente_id AND a.empresa_id = c.empresa_id
       WHERE c.empresa_id = $1::uuid
       GROUP BY c.agente_id, a.nombre
       ORDER BY total DESC, a.nombre ASC NULLS LAST`,
      [ALQUILOYA_EMPRESA_ID]
    );

    // 3. By date — últimos 30 días por día (serie completa, incluye días sin captaciones)
    const byDate = await queryWithRetry<{ dia: string; total: number }>(
      pool,
      `WITH dias AS (
         SELECT (current_date - i)::date AS dia
         FROM generate_series(0, 29) AS g(i)
       )
       SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
              COALESCE(c.n, 0)::int AS total
         FROM dias d
         LEFT JOIN (
           SELECT date_trunc('day', created_at)::date AS dia, count(*)::int AS n
             FROM "alquiloya"."agente_captaciones"
            WHERE empresa_id = $1::uuid
              AND created_at >= now() - interval '30 days'
            GROUP BY 1
         ) c ON c.dia = d.dia
        ORDER BY d.dia ASC`,
      [ALQUILOYA_EMPRESA_ID]
    );

    // 4. By status (flat)
    const byStatus = [
      { etapa: "nuevo", n: c.nuevo },
      { etapa: "contacto", n: c.contacto },
      { etapa: "negocio_activo", n: c.negocio_activo },
      { etapa: "cerrado", n: c.cerrado },
      { etapa: "rechazado", n: c.rechazado },
    ];

    // 5. Recent items (últimas 20)
    const recent = await queryWithRetry(
      pool,
      `SELECT c.id, c.propietario_nombre, c.propietario_email, c.propietario_telefono,
              c.propiedad_titulo, c.ciudad, c.barrio, c.etapa, c.estado,
              c.created_at::text AS created_at,
              c.agente_id, a.nombre AS agente_nombre
         FROM "alquiloya"."agente_captaciones" c
         LEFT JOIN "alquiloya"."agentes" a
           ON a.id = c.agente_id AND a.empresa_id = c.empresa_id
        WHERE c.empresa_id = $1::uuid
        ORDER BY c.created_at DESC
        LIMIT 20`,
      [ALQUILOYA_EMPRESA_ID]
    );

    return NextResponse.json({
      success: true,
      cards: {
        total: c.total,
        nuevo: c.nuevo,
        contacto: c.contacto,
        negocio_activo: c.negocio_activo,
        cerrado: c.cerrado,
        rechazado: c.rechazado,
        tasa_cierre,
        ult_7: c.ult_7,
        ult_30: c.ult_30,
      },
      by_agent: byAgent.rows ?? [],
      by_status: byStatus,
      by_date: byDate.rows ?? [],
      recent_items: recent.rows ?? [],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api dashboard/alquiloya-captaciones/resumen GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
