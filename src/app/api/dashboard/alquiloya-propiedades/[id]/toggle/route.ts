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
function b(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    const activo = b(body.activo);
    const visibleWeb = b(body.visible_web);
    const destacada = b(body.destacada);
    if (activo !== undefined) {
      vals.push(activo);
      sets.push(`activo = $${vals.length}`);
    }
    if (visibleWeb !== undefined) {
      vals.push(visibleWeb);
      sets.push(`visible_web = $${vals.length}`);
    }
    if (destacada !== undefined) {
      vals.push(destacada);
      sets.push(`destacada = $${vals.length}`);
      // Duracion en dias: si activan con duracion, calculamos vencimiento.
      // duracion_dias: number (1..365) o null = sin vencimiento.
      if (destacada) {
        const dRaw = body.duracion_dias;
        let dias: number | null = null;
        if (dRaw === null || dRaw === "" || dRaw === undefined) {
          dias = null;
        } else {
          const x = Number(dRaw);
          if (Number.isFinite(x) && x > 0 && x <= 365) dias = Math.trunc(x);
          else if (x === 0) dias = null;
        }
        if (dias == null) {
          sets.push(`destacada_hasta = NULL`);
        } else {
          vals.push(dias);
          sets.push(`destacada_hasta = now() + ($${vals.length}::int * INTERVAL '1 day')`);
        }
      } else {
        // Al desdestacar, limpiamos la fecha.
        sets.push(`destacada_hasta = NULL`);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "sin cambios" }, { status: 400 });
    }

    vals.push(ALQUILOYA_EMPRESA_ID);
    vals.push(id);
    const sql = `UPDATE ${t("propiedades")} SET ${sets.join(", ")}, updated_at = now()
                  WHERE empresa_id = $${vals.length - 1}::uuid
                    AND id = $${vals.length}::uuid
                  RETURNING id, activo, visible_web, destacada, destacada_hasta::text AS destacada_hasta`;
    const r = await queryWithRetry<{ id: string; activo: boolean; visible_web: boolean; destacada: boolean; destacada_hasta: string | null }>(
      pool,
      sql,
      vals
    );
    if (!r.rows || r.rows.length === 0) {
      return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...r.rows[0] });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propiedades/[id]/toggle]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
