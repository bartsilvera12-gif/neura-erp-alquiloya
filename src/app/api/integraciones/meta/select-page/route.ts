// POST /api/integraciones/meta/select-page
// Body: { page_id: string, use_instagram: boolean }
// Toma el pending cifrado del callback y persiste la Page/IG elegida.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, requirePropietarioContext, sanitizeError } from "@/lib/meta/propietario";
import { decryptMetaSecret } from "@/lib/meta/security";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENDING_COOKIE = "neura_meta_pending";

type PendingSelection = {
  pid: string;
  eat: string;
  tex: number | null;
  scopes: string[];
  pages: Array<{
    id: string;
    name: string;
    eat_page: string;
    instagram_business_account_id: string | null;
    instagram_username: string | null;
  }>;
};

export async function POST(request: Request) {
  try {
    const ctx = await requirePropietarioContext(request);
    if (ctx instanceof NextResponse) return ctx;

    const body = (await request.json().catch(() => ({}))) as {
      page_id?: string;
      use_instagram?: boolean;
    };
    const pageId = String(body.page_id ?? "").trim();
    const useIg = !!body.use_instagram;
    if (!pageId) return NextResponse.json({ error: "page_id requerido" }, { status: 400 });

    const jar = await cookies();
    const encoded = jar.get(PENDING_COOKIE)?.value ?? null;
    if (!encoded) {
      return NextResponse.json(
        { error: "No hay conexion pendiente. Reintentar OAuth." },
        { status: 400 },
      );
    }

    let pending: PendingSelection;
    try {
      pending = JSON.parse(decryptMetaSecret(encoded)) as PendingSelection;
    } catch (e) {
      return NextResponse.json(
        { error: "Pending corrupto: " + sanitizeError(e) },
        { status: 400 },
      );
    }

    if (pending.pid !== ctx.propietarioId) {
      return NextResponse.json(
        { error: "El propietario del pending no matchea el logueado" },
        { status: 403 },
      );
    }

    const chosen = pending.pages.find((p) => p.id === pageId);
    if (!chosen) return NextResponse.json({ error: "page_id no encontrado" }, { status: 404 });

    const igId = useIg ? chosen.instagram_business_account_id : null;
    const igUsername = useIg ? chosen.instagram_username : null;

    const pool = getPool();
    const tokenExpiresAtSql = pending.tex ? "to_timestamp(" + pending.tex + ")" : "NULL";
    await queryWithRetry(
      pool,
      "INSERT INTO \"alquiloya\".\"propietario_redes_sociales\"" +
      "  (empresa_id, propietario_id, provider," +
      "   facebook_page_id, instagram_account_id," +
      "   account_name, username," +
      "   access_token_encrypted, token_expires_at," +
      "   scopes, status, last_validated_at)" +
      " VALUES ($1::uuid, $2::uuid, 'meta'," +
      "         $3, $4," +
      "         $5, $6," +
      "         $7, " + tokenExpiresAtSql + "," +
      "         $8::jsonb, 'connected', now())" +
      " ON CONFLICT (empresa_id, propietario_id, provider," +
      "              COALESCE(facebook_page_id, ''), COALESCE(instagram_account_id, ''))" +
      " DO UPDATE SET" +
      "   account_name = EXCLUDED.account_name," +
      "   username = EXCLUDED.username," +
      "   access_token_encrypted = EXCLUDED.access_token_encrypted," +
      "   token_expires_at = EXCLUDED.token_expires_at," +
      "   scopes = EXCLUDED.scopes," +
      "   status = 'connected'," +
      "   last_validated_at = now()," +
      "   updated_at = now()",
      [
        ctx.empresaId,
        ctx.propietarioId,
        chosen.id,
        igId,
        chosen.name,
        igUsername,
        chosen.eat_page,
        JSON.stringify(pending.scopes ?? []),
      ],
    );

    const res = NextResponse.json({ success: true });
    res.cookies.set(PENDING_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    console.error("[api/integraciones/meta/select-page]", sanitizeError(err));
    return NextResponse.json({ error: "No se pudo guardar la seleccion" }, { status: 500 });
  }
}
