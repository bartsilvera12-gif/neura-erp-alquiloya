// GET /api/integraciones/meta/status
// Devuelve las conexiones Meta del propietario logueado, para renderizar la UI
// del panel. NUNCA incluye access_token — solo metadata.

import { NextResponse } from "next/server";
import { getPool, requirePropietarioContext, sanitizeError } from "@/lib/meta/propietario";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  provider: string;
  facebook_page_id: string | null;
  instagram_account_id: string | null;
  account_name: string | null;
  username: string | null;
  token_expires_at: string | null;
  scopes: unknown;
  status: string;
  auto_publish_facebook: boolean;
  auto_publish_instagram: boolean;
  last_validated_at: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    const ctx = await requirePropietarioContext(request);
    if (ctx instanceof NextResponse) return ctx;

    const pool = getPool();
    const { rows } = await queryWithRetry<Row>(
      pool,
      "SELECT id, provider, facebook_page_id, instagram_account_id," +
      "       account_name, username, token_expires_at::text AS token_expires_at," +
      "       scopes, status, auto_publish_facebook, auto_publish_instagram," +
      "       last_validated_at::text AS last_validated_at," +
      "       created_at::text AS created_at" +
      "  FROM \"alquiloya\".\"propietario_redes_sociales\"" +
      " WHERE empresa_id = $1::uuid AND propietario_id = $2::uuid" +
      " ORDER BY created_at DESC",
      [ctx.empresaId, ctx.propietarioId],
    );

    return NextResponse.json({ success: true, conexiones: rows ?? [] });
  } catch (err) {
    console.error("[api/integraciones/meta/status]", sanitizeError(err));
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
