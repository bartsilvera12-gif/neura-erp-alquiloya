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
  if (!x) return null;
  return x.slice(0, max);
}
function uuid(v: unknown): string | null {
  const x = s(v, 40);
  return x && uuidRe.test(x) ? x : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const propiedadId = uuid(body.propiedad_id);
    let agenteId = uuid(body.agente_id);
    const nombre = s(body.nombre, 160);
    const email = s(body.email, 160);
    const telefono = s(body.telefono, 40);
    const mensaje = s(body.mensaje, 2000);

    const canalRaw = s(body.canal, 20) ?? "web";
    const canal = ["web", "whatsapp", "telefono", "mail", "otro"].includes(canalRaw) ? canalRaw : "web";

    // Exigimos nombre + un dato de contacto (telefono o email). Antes
    // alcanzaba con CUALQUIER campo y dejaba pasar consultas "anonimas"
    // sin manera de responderlas — el agente las recibia sin saber a
    // quien escribirle (bug reportado por Karen: 'ultimas consultas
    // sigue siendo inutil').
    if (!nombre) {
      return NextResponse.json(errorResponse("El nombre es obligatorio."), { status: 400 });
    }
    if (!telefono && !email) {
      return NextResponse.json(errorResponse("Necesitamos teléfono o email para que el agente te pueda contactar."), { status: 400 });
    }
    if (!propiedadId) {
      return NextResponse.json(errorResponse("Falta el id de la propiedad."), { status: 400 });
    }
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });

    // Si no vino agente_id pero sí propiedad_id, intentamos resolver el agente de la propiedad.
    if (!agenteId && propiedadId) {
      try {
        const r = await queryWithRetry<{ agente_id: string | null }>(
          pool,
          `SELECT agente_id FROM "alquiloya"."propiedades"
            WHERE empresa_id = $1::uuid AND id = $2::uuid LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, propiedadId]
        );
        const ag = r.rows[0]?.agente_id ?? null;
        if (ag) agenteId = ag;
      } catch {
        // best-effort
      }
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const ua = request.headers.get("user-agent")?.slice(0, 400) ?? null;

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO "alquiloya"."consultas"
         (empresa_id, agente_id, propiedad_id, nombre, telefono, email, mensaje, canal, ip, user_agent)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        ALQUILOYA_EMPRESA_ID, agenteId, propiedadId,
        nombre, telefono, email, mensaje, canal, ip, ua,
      ]
    );
    return NextResponse.json(successResponse({ id: rows[0].id }));
  } catch (err) {
    console.error(
      "[api/public/alquiloya/consultas POST]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(errorResponse("No se pudo registrar la consulta"), { status: 500 });
  }
}
