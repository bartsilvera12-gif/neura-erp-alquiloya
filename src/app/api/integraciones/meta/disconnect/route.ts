// POST /api/integraciones/meta/disconnect
// Body: { conexion_id: string }
// Marca la conexion como 'revoked' y borra el access_token cifrado.

import { NextResponse } from "next/server";
import { getPool, requirePropietarioContext, sanitizeError } from "@/lib/meta/propietario";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ctx = await requirePropietarioContext(request);
    if (ctx instanceof NextResponse) return ctx;

    const body = (await request.json().catch(() => ({}))) as { conexion_id?: string };
    const id = String(body.conexion_id ?? "").trim();
    if (!id) return NextResponse.json({ error: "conexion_id requerido" }, { status: 400 });

    const pool = getPool();
    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      "UPDATE \"alquiloya\".\"propietario_redes_sociales\"" +
      "   SET status = 'revoked'," +
      "       access_token_encrypted = ''," +
      "       auto_publish_facebook = false," +
      "       auto_publish_instagram = false," +
      "       updated_at = now()" +
      " WHERE empresa_id = $1::uuid" +
      "   AND propietario_id = $2::uuid" +
      "   AND id = $3::uuid" +
      " RETURNING id",
      [ctx.empresaId, ctx.propietarioId, id],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Conexion no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/integraciones/meta/disconnect]", sanitizeError(err));
    return NextResponse.json({ error: "No se pudo desconectar" }, { status: 500 });
  }
}
