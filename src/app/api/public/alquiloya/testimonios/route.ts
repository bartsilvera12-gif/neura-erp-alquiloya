import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";

export const runtime = "nodejs";
// Cache 60s — los testimonios cambian con baja frecuencia.
export const revalidate = 60;

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

/**
 * Fuente unica de reseñas para el home publico: alquiloya.agente_resenas
 * filtrado por estado='aprobada' AND destacada_home=true.
 *
 * El admin elige cuales aparecen desde el ERP (/dashboard/agente-resenas).
 * La tabla alquiloya.testimonios queda obsoleta — no se consulta mas desde
 * aqui, pero se conserva para no romper el ABM previo.
 */
export async function GET() {
  try {
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });
    const { rows } = await queryWithRetry(
      pool,
      `SELECT r.id,
              r.autor_nombre   AS autor,
              r.rol            AS rol,
              NULL::text       AS ciudad,
              r.body           AS contenido,
              a.foto_url       AS foto_url,
              r.stars          AS calificacion,
              true             AS destacado
         FROM "alquiloya"."agente_resenas" r
         LEFT JOIN "alquiloya"."agentes" a
           ON a.empresa_id = r.empresa_id AND a.id = r.agente_id
        WHERE r.empresa_id = $1::uuid
          AND r.estado = 'aprobada'
          AND COALESCE(r.destacada_home, false) = true
        ORDER BY r.revisado_at DESC NULLS LAST, r.created_at DESC NULLS LAST
        LIMIT 24`,
      [ALQUILOYA_EMPRESA_ID]
    );
    return NextResponse.json(successResponse({ testimonios: rows ?? [] }));
  } catch (err) {
    console.error("[api/public/alquiloya/testimonios]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los testimonios"), { status: 500 });
  }
}
