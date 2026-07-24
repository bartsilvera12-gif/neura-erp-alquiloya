// POST /api/integraciones/meta/select-page
// Body: { page_id: string, use_instagram: boolean }
// Persiste la Page/IG elegida en alquiloya.propietario_redes_sociales.
// El INSERT setea propietario_id XOR agente_id segun el ownerType.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, requireOwnerContext, sanitizeError } from "@/lib/meta/owner";
import { decryptMetaSecret } from "@/lib/meta/security";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENDING_COOKIE = "neura_meta_pending";

type PendingSelection = {
  owner_type: "propietario" | "agente";
  owner_id: string;
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
    const ctx = await requireOwnerContext(request);
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

    if (pending.owner_type !== ctx.ownerType || pending.owner_id !== ctx.ownerId) {
      return NextResponse.json(
        { error: "El owner del pending no matchea el logueado" },
        { status: 403 },
      );
    }

    const chosen = pending.pages.find((p) => p.id === pageId);
    if (!chosen) return NextResponse.json({ error: "page_id no encontrado" }, { status: 404 });

    const igId = useIg ? chosen.instagram_business_account_id : null;
    const igUsername = useIg ? chosen.instagram_username : null;

    // Setea propietario_id o agente_id segun ownerType, el otro va NULL.
    const propietarioId = ctx.ownerType === "propietario" ? ctx.ownerId : null;
    const agenteId = ctx.ownerType === "agente" ? ctx.ownerId : null;

    const pool = getPool();
    const tokenExpiresAtSql = pending.tex ? "to_timestamp(" + pending.tex + ")" : "NULL";
    await queryWithRetry(
      pool,
      "INSERT INTO \"alquiloya\".\"propietario_redes_sociales\"" +
      "  (empresa_id, propietario_id, agente_id, provider," +
      "   facebook_page_id, instagram_account_id," +
      "   account_name, username," +
      "   access_token_encrypted, token_expires_at," +
      "   scopes, status, last_validated_at)" +
      " VALUES ($1::uuid, $2::uuid, $3::uuid, 'meta'," +
      "         $4, $5," +
      "         $6, $7," +
      "         $8, " + tokenExpiresAtSql + "," +
      "         $9::jsonb, 'connected', now())" +
      " ON CONFLICT (empresa_id, COALESCE(propietario_id, agente_id), provider," +
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
        propietarioId,
        agenteId,
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
