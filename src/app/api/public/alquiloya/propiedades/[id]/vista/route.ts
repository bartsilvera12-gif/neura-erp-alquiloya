import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cache modulo-level para bootstrap one-shot (igual patron que otros endpoints)
let bootstrapped = false;
async function ensureColumns(pool: NonNullable<ReturnType<typeof getChatPostgresPool>>) {
  if (bootstrapped) return;
  try {
    await queryWithRetry(
      pool,
      `ALTER TABLE "alquiloya"."propiedades"
         ADD COLUMN IF NOT EXISTS vistas_count integer NOT NULL DEFAULT 0`,
      []
    );
    await queryWithRetry(
      pool,
      `ALTER TABLE "alquiloya"."propiedades"
         ADD COLUMN IF NOT EXISTS ultima_vista_at timestamptz`,
      []
    );
    bootstrapped = true;
  } catch (e) {
    console.warn("[vista bootstrap]", e instanceof Error ? e.message : e);
  }
}

/**
 * POST /api/public/alquiloya/propiedades/[id]/vista
 *
 * Incrementa el contador de vistas de la propiedad. Llamado desde el detail
 * publico (detail.jsx) al montar el componente. No requiere auth.
 *
 * Dedup simple via sessionStorage del lado del cliente — aca solo confiamos
 * en lo que el cliente nos manda.
 */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    await ensureColumns(pool);

    const r = await queryWithRetry<{ vistas_count: number }>(
      pool,
      `UPDATE "alquiloya"."propiedades"
          SET vistas_count = COALESCE(vistas_count, 0) + 1,
              ultima_vista_at = now()
        WHERE empresa_id = $1::uuid AND id = $2::uuid
        RETURNING vistas_count`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (r.rows.length === 0) {
      // Silencioso: no exponemos si la propiedad existe o no por privacy.
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: true, vistas: r.rows[0].vistas_count });
  } catch (err) {
    console.error("[vista POST]", err);
    return NextResponse.json({ success: true });
  }
}
