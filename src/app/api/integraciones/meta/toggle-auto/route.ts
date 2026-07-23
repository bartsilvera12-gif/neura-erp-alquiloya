// POST /api/integraciones/meta/toggle-auto
// Body: { conexion_id: string, network: 'facebook'|'instagram', enabled: boolean }

import { NextResponse } from "next/server";
import { getPool, requirePropietarioContext, sanitizeError } from "@/lib/meta/propietario";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ctx = await requirePropietarioContext(request);
    if (ctx instanceof NextResponse) return ctx;

    const body = (await request.json().catch(() => ({}))) as {
      conexion_id?: string;
      network?: string;
      enabled?: boolean;
    };
    const id = String(body.conexion_id ?? "").trim();
    const network = String(body.network ?? "").trim();
    const enabled = !!body.enabled;
    if (!id) return NextResponse.json({ error: "conexion_id requerido" }, { status: 400 });
    if (network !== "facebook" && network !== "instagram") {
      return NextResponse.json({ error: "network invalido" }, { status: 400 });
    }

    // col es un literal validado arriba (solo 2 valores), no viene del body
    const col = network === "facebook" ? "auto_publish_facebook" : "auto_publish_instagram";

    const pool = getPool();
    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      "UPDATE \"alquiloya\".\"propietario_redes_sociales\"" +
      "   SET " + col + " = $4, updated_at = now()" +
      " WHERE empresa_id = $1::uuid" +
      "   AND propietario_id = $2::uuid" +
      "   AND id = $3::uuid" +
      "   AND status = 'connected'" +
      " RETURNING id",
      [ctx.empresaId, ctx.propietarioId, id, enabled],
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Conexion no encontrada o desconectada" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/integraciones/meta/toggle-auto]", sanitizeError(err));
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
