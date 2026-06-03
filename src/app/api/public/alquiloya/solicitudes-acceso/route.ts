import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  if (!x) return null;
  return x.slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const tipoRaw = s(body.tipo, 20);
    if (tipoRaw !== "agente" && tipoRaw !== "propietario") {
      return NextResponse.json(errorResponse("tipo invalido"), { status: 400 });
    }
    const tipo = tipoRaw;

    let subTipo: string | null = null;
    if (tipo === "agente") {
      const v = s(body.sub_tipo, 40);
      if (v !== "Independiente" && v !== "Inmobiliaria") {
        return NextResponse.json(errorResponse("sub_tipo invalido (Independiente|Inmobiliaria)"), { status: 400 });
      }
      subTipo = v;
    }

    const nombre = s(body.nombre, 160);
    if (!nombre) return NextResponse.json(errorResponse("nombre requerido"), { status: 400 });

    const email = s(body.email, 160);
    const telefono = s(body.telefono, 40);
    if (!email && !telefono) {
      return NextResponse.json(errorResponse("ingresá al menos email o telefono"), { status: 400 });
    }

    const empresa = s(body.empresa, 160);
    const ciudad = s(body.ciudad, 80);
    const mensaje = s(body.mensaje, 1200);

    const pool = getChatPostgresPool();
    if (!pool) {
      return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });
    }

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO "alquiloya"."solicitudes_acceso"
         (empresa_id, tipo, sub_tipo, nombre, email, telefono, empresa, ciudad, mensaje, estado)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente')
       RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, tipo, subTipo, nombre, email, telefono, empresa, ciudad, mensaje]
    );
    return NextResponse.json(successResponse({ id: rows[0].id }));
  } catch (err) {
    console.error(
      "[api/public/alquiloya/solicitudes-acceso POST]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(errorResponse("No se pudo registrar la solicitud"), { status: 500 });
  }
}
