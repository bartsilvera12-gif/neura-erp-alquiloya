import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown, max = 120): string | null {
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
    `SELECT id, ciudad, barrio, orden FROM "alquiloya"."agente_zonas"
      WHERE empresa_id=$1::uuid AND agente_id=$2::uuid
      ORDER BY orden ASC, created_at ASC`,
    [ALQUILOYA_EMPRESA_ID, id]
  );
  return NextResponse.json({ success: true, data: { zonas: rows } });
}

export async function POST(request: Request, ctx: Ctx) {
  const user = await getAuthUserForApiRoute(request);
  if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await ctx.params;
  if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ciudad = s(body.ciudad);
  if (!ciudad) return NextResponse.json({ error: "ciudad requerida" }, { status: 400 });
  const barrio = s(body.barrio);
  const orden = Number(body.orden);
  const pool = getChatPostgresPool();
  if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
  const { rows } = await queryWithRetry<{ id: string }>(
    pool,
    `INSERT INTO "alquiloya"."agente_zonas" (empresa_id, agente_id, ciudad, barrio, orden)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5) RETURNING id`,
    [ALQUILOYA_EMPRESA_ID, id, ciudad, barrio, Number.isFinite(orden) ? Math.trunc(orden) : 0]
  );
  return NextResponse.json({ success: true, id: rows[0].id });
}
