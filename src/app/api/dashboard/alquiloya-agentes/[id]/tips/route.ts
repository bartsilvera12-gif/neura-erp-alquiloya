import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const user = await getAuthUserForApiRoute(request);
  if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await ctx.params;
  if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });
  const pool = getChatPostgresPool();
  if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
  const { rows } = await queryWithRetry(
    pool,
    `SELECT id, zona, titulo, body, orden, activo
       FROM "alquiloya"."agente_tips"
      WHERE empresa_id=$1::uuid AND agente_id=$2::uuid
      ORDER BY orden ASC, created_at ASC`,
    [ALQUILOYA_EMPRESA_ID, id]
  );
  return NextResponse.json({ success: true, data: { tips: rows } });
}

export async function POST(request: Request, ctx: Ctx) {
  const user = await getAuthUserForApiRoute(request);
  if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await ctx.params;
  if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const titulo = s(body.titulo, 200);
  const bodyTxt = s(body.body, 4000);
  if (!titulo || !bodyTxt) {
    return NextResponse.json({ error: "titulo y body requeridos" }, { status: 400 });
  }
  const zona = s(body.zona, 120);
  const orden = Number(body.orden);
  const pool = getChatPostgresPool();
  if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
  const { rows } = await queryWithRetry<{ id: string }>(
    pool,
    `INSERT INTO "alquiloya"."agente_tips" (empresa_id, agente_id, zona, titulo, body, orden, activo)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true) RETURNING id`,
    [ALQUILOYA_EMPRESA_ID, id, zona, titulo, bodyTxt, Number.isFinite(orden) ? Math.trunc(orden) : 0]
  );
  return NextResponse.json({ success: true, id: rows[0].id });
}
