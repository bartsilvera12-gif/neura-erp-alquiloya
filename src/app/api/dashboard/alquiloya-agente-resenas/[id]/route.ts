import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await getAuthUserForApiRoute(request);
  if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await ctx.params;
  if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = s(body.action, 20);
  if (
    action !== "aprobar" &&
    action !== "rechazar" &&
    action !== "destacar" &&
    action !== "no_destacar"
  ) {
    return NextResponse.json(
      { error: "action invalida (aprobar|rechazar|destacar|no_destacar)" },
      { status: 400 }
    );
  }

  const pool = getChatPostgresPool();
  if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

  // Toggle destacada_home — solo aplica a reseñas ya aprobadas.
  if (action === "destacar" || action === "no_destacar") {
    const nextValue = action === "destacar";
    const { rows: destRows } = await queryWithRetry<{ id: string; destacada_home: boolean }>(
      pool,
      `UPDATE "alquiloya"."agente_resenas"
          SET destacada_home=$3
        WHERE empresa_id=$1::uuid AND id=$2::uuid AND estado='aprobada'
        RETURNING id, destacada_home`,
      [ALQUILOYA_EMPRESA_ID, id, nextValue]
    );
    if (destRows.length === 0) {
      return NextResponse.json({ error: "no encontrada o no esta aprobada" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      id: destRows[0].id,
      destacada_home: destRows[0].destacada_home,
    });
  }

  const motivo = s(body.motivo_rechazo, 500);
  const nextEstado = action === "aprobar" ? "aprobada" : "rechazada";

  const { rows } = await queryWithRetry<{ id: string }>(
    pool,
    `UPDATE "alquiloya"."agente_resenas"
        SET estado=$3, motivo_rechazo=$4,
            revisado_por=$5::uuid, revisado_at=now()
      WHERE empresa_id=$1::uuid AND id=$2::uuid AND estado='pendiente'
      RETURNING id`,
    [ALQUILOYA_EMPRESA_ID, id, nextEstado, action === "rechazar" ? motivo : null, user.id]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "no encontrada o ya revisada" }, { status: 404 });
  }
  return NextResponse.json({ success: true, id: rows[0].id, estado: nextEstado });
}
