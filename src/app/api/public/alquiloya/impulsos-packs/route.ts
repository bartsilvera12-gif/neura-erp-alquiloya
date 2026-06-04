import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";

export const runtime = "nodejs";
// Cache 60s — los packs cambian con baja frecuencia, no necesitan tiempo real.
export const revalidate = 60;

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

export async function GET() {
  try {
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });
    const { rows } = await queryWithRetry(
      pool,
      `SELECT id, codigo, qty, precio::float8 AS precio, moneda, badge, orden
         FROM "alquiloya"."impulsos_packs"
        WHERE empresa_id = $1::uuid AND activo = true
        ORDER BY orden ASC, qty ASC`,
      [ALQUILOYA_EMPRESA_ID]
    );
    return NextResponse.json(successResponse({ packs: rows ?? [] }));
  } catch (err) {
    console.error("[api/public/alquiloya/impulsos-packs]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los packs"), { status: 500 });
  }
}
