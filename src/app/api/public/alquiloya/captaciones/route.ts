import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length > 0 ? x : null;
}
function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

type Body = {
  agente_id?: string;
  propietario_nombre?: string;
  propietario_email?: string;
  propietario_telefono?: string;
  propiedad_titulo?: string;
  tipo_propiedad?: string;
  ciudad?: string;
  barrio?: string;
  direccion?: string;
  precio_estimado?: number | string;
  mensaje?: string;
  origen?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

    const agenteId = s(body.agente_id);
    if (!agenteId || !uuidRe.test(agenteId)) {
      return NextResponse.json({ error: "agente_id requerido" }, { status: 400 });
    }

    const nombre = s(body.propietario_nombre);
    if (!nombre) return NextResponse.json({ error: "propietario_nombre requerido" }, { status: 400 });

    const email = s(body.propietario_email);
    const telefono = s(body.propietario_telefono);
    if (!email && !telefono) {
      return NextResponse.json(
        { error: "Necesitamos email o teléfono para que el agente te contacte." },
        { status: 400 }
      );
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // Validar agente activo y de AlquiloYa
    const ag = await queryWithRetry<{ id: string; activo: boolean }>(
      pool,
      `SELECT id, activo FROM alquiloya.agentes
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, agenteId]
    );
    if (!ag.rows || ag.rows.length === 0) {
      return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
    }
    if (!ag.rows[0].activo) {
      return NextResponse.json({ error: "Agente no disponible" }, { status: 409 });
    }

    const origen = (s(body.origen) ?? "web_publica").slice(0, 60);

    const ins = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO alquiloya.agente_captaciones (
         empresa_id, agente_id, propietario_nombre, propietario_email, propietario_telefono,
         propiedad_titulo, tipo_propiedad, ciudad, barrio, direccion,
         precio_estimado, mensaje, origen
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        ALQUILOYA_EMPRESA_ID,
        agenteId,
        nombre,
        email,
        telefono,
        s(body.propiedad_titulo),
        s(body.tipo_propiedad),
        s(body.ciudad),
        s(body.barrio),
        s(body.direccion),
        n(body.precio_estimado),
        s(body.mensaje),
        origen,
      ]
    );

    return NextResponse.json({ success: true, id: ins.rows[0].id });
  } catch (err) {
    console.error("[api public alquiloya/captaciones POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
