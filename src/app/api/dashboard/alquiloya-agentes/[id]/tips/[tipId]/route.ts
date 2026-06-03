import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string; tipId: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  const user = await getAuthUserForApiRoute(request);
  if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id, tipId } = await ctx.params;
  if (!uuidRe.test(id) || !uuidRe.test(tipId)) {
    return NextResponse.json({ error: "id invalido" }, { status: 400 });
  }
  const pool = getChatPostgresPool();
  if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
  const { rows } = await queryWithRetry<{ id: string }>(
    pool,
    `DELETE FROM "alquiloya"."agente_tips"
      WHERE empresa_id=$1::uuid AND agente_id=$2::uuid AND id=$3::uuid
      RETURNING id`,
    [ALQUILOYA_EMPRESA_ID, id, tipId]
  );
  if (rows.length === 0) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  return NextResponse.json({ success: true, id: rows[0].id });
}
