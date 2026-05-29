import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ETAPAS_PERMITIDAS = new Set([
  "nuevo",
  "contacto",
  "negocio_activo",
  "cerrado",
  "rechazado",
]);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await ctx.params;
    if (!uuidRe.test(id)) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { etapa?: string };
    const etapa = typeof body.etapa === "string" ? body.etapa.trim() : "";
    if (!ETAPAS_PERMITIDAS.has(etapa)) {
      return NextResponse.json(
        { error: "etapa invalida", permitidas: Array.from(ETAPAS_PERMITIDAS) },
        { status: 400 }
      );
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const r = await queryWithRetry<{ id: string; etapa: string; updated_at: string }>(
      pool,
      `UPDATE "alquiloya"."agente_captaciones"
          SET etapa = $1, updated_at = now()
        WHERE empresa_id = $2::uuid AND id = $3::uuid
        RETURNING id, etapa, updated_at::text AS updated_at`,
      [etapa, ALQUILOYA_EMPRESA_ID, id]
    );
    if (!r.rows || r.rows.length === 0) {
      return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error("[api dashboard/alquiloya-captaciones/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
