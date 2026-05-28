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

    const { rows } = await queryWithRetry(
      pool,
      `SELECT id, tier, target, nombre,
              precio::float8 AS precio, moneda, billing, badge,
              COALESCE(bullets, '[]'::jsonb)  AS bullets,
              COALESCE(excluded, '[]'::jsonb) AS excluded,
              cta, highlighted, free_boosts, orden, activo
         FROM "alquiloya"."planes_publicacion"
         WHERE empresa_id = $1::uuid
         ORDER BY orden ASC, nombre ASC`,
      [ALQUILOYA_EMPRESA_ID]
    );
    return NextResponse.json({ success: true, data: { planes: rows } });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-planes-publicacion GET]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
