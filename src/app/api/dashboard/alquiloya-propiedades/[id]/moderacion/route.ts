import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}
function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}

/**
 * POST /api/dashboard/alquiloya-propiedades/[id]/moderacion
 * Body: { action: 'aprobar' | 'rechazar', motivo?: string }
 *
 *   aprobar  -> activo=true, visible_web=true, estado='disponible' si era 'inactiva'/null
 *   rechazar -> estado='rechazada' (queda fuera de la cola pero no se borra)
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = s(body.action, 20);
    if (action !== "aprobar" && action !== "rechazar") {
      return NextResponse.json({ error: "action invalida (aprobar|rechazar)" }, { status: 400 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    if (action === "aprobar") {
      const r = await queryWithRetry<{ id: string }>(
        pool,
        `UPDATE ${t("propiedades")} SET
            activo = true,
            visible_web = true,
            estado = CASE
              WHEN estado IS NULL OR estado IN ('inactiva','rechazada','pausada') THEN 'disponible'
              ELSE estado
            END,
            updated_at = now()
          WHERE empresa_id = $1::uuid AND id = $2::uuid
          RETURNING id`,
        [ALQUILOYA_EMPRESA_ID, id]
      );
      if (!r.rows || r.rows.length === 0) {
        return NextResponse.json({ error: "no encontrada" }, { status: 404 });
      }
      return NextResponse.json({ success: true, id: r.rows[0].id, estado: "aprobada" });
    }

    // rechazar
    const motivo = s(body.motivo, 500);
    const r = await queryWithRetry<{ id: string }>(
      pool,
      `UPDATE ${t("propiedades")} SET
          estado = 'rechazada',
          activo = false,
          visible_web = false,
          descripcion = CASE
            WHEN $3::text IS NULL THEN descripcion
            ELSE COALESCE(descripcion,'') || E'\n\n[Moderación] Rechazada: ' || $3::text
          END,
          updated_at = now()
        WHERE empresa_id = $1::uuid AND id = $2::uuid
        RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, id, motivo]
    );
    if (!r.rows || r.rows.length === 0) {
      return NextResponse.json({ error: "no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ success: true, id: r.rows[0].id, estado: "rechazada" });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propiedades/[id]/moderacion]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
