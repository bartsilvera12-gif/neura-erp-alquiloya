import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";

export const runtime = "nodejs";
// Cache 60s — los planes cambian con baja frecuencia, no necesitan tiempo real.
export const revalidate = 60;

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

type PlanRow = {
  id: string;
  tier: string;
  target: string | null;
  nombre: string;
  precio: number;
  moneda: string;
  billing: string;
  badge: string | null;
  bullets: string[];
  excluded: string[];
  cta: string | null;
  highlighted: boolean;
  free_boosts: number | null;
  orden: number;
};

export async function GET() {
  try {
    const pool = getChatPostgresPool();
    if (!pool) {
      return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });
    }
    const { rows } = await queryWithRetry<PlanRow>(
      pool,
      `SELECT id, tier, target, nombre,
              precio::float8 AS precio, moneda, billing, badge,
              COALESCE(bullets, '[]'::jsonb)  AS bullets,
              COALESCE(excluded, '[]'::jsonb) AS excluded,
              cta, highlighted, free_boosts, orden
         FROM "alquiloya"."planes_publicacion"
         WHERE empresa_id = $1::uuid AND activo = true
         ORDER BY orden ASC, nombre ASC`,
      [ALQUILOYA_EMPRESA_ID]
    );
    return NextResponse.json(successResponse({ planes: rows ?? [] }));
  } catch (err) {
    console.error(
      "[api/public/alquiloya/planes-publicacion]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(errorResponse("No se pudieron cargar los planes"), {
      status: 500,
    });
  }
}
