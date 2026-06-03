import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";

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

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) {
      return NextResponse.json(errorResponse("agente id invalido"), { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const autorNombre = s(body.autor_nombre, 120);
    if (!autorNombre) return NextResponse.json(errorResponse("autor_nombre requerido"), { status: 400 });

    const starsRaw = Number(body.stars);
    if (!Number.isFinite(starsRaw) || starsRaw < 1 || starsRaw > 5) {
      return NextResponse.json(errorResponse("stars debe estar entre 1 y 5"), { status: 400 });
    }
    const stars = Math.trunc(starsRaw);

    const reviewBody = s(body.body, 2000);
    if (!reviewBody || reviewBody.length < 15) {
      return NextResponse.json(errorResponse("escribí al menos 15 caracteres en tu reseña"), { status: 400 });
    }

    const rol = s(body.rol, 40);
    const autorEmail = s(body.autor_email, 160);
    const autorTelefono = s(body.autor_telefono, 40);

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });

    const { rows: agenteRows } = await queryWithRetry<{ id: string }>(
      pool,
      `SELECT id FROM "alquiloya"."agentes"
        WHERE empresa_id=$1::uuid AND id=$2::uuid AND activo=true LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (agenteRows.length === 0) {
      return NextResponse.json(errorResponse("agente no encontrado"), { status: 404 });
    }

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO "alquiloya"."agente_resenas"
         (empresa_id, agente_id, autor_nombre, autor_email, autor_telefono, rol, stars, body, estado)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, 'pendiente')
       RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, id, autorNombre, autorEmail, autorTelefono, rol, stars, reviewBody]
    );

    return NextResponse.json(successResponse({ id: rows[0].id, estado: "pendiente" }));
  } catch (err) {
    console.error(
      "[api/public/alquiloya/agentes/[id]/resenas POST]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(errorResponse("No se pudo registrar la reseña"), { status: 500 });
  }
}
