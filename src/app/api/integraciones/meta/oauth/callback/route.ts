// GET /api/integraciones/meta/oauth/callback
// Meta redirige aqui con ?code=...&state=... (o error).
// 1. validamos state contra cookie nonce (CSRF)
// 2. decodificamos owner (propietario XOR agente) del payload
// 3. intercambiamos code -> short token -> long-lived
// 4. listamos Pages, IG por page
// 5. dejamos "pending" cifrado en cookie con owner info y redirigimos al panel

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyState, STATE_COOKIE_NAME } from "@/lib/meta/state-cookie";
import {
  exchangeCodeForToken,
  upgradeToLongLivedToken,
  listPagesForUser,
  getPageInstagramInfo,
  getIgAccountInfo,
  debugToken,
} from "@/lib/meta/graph-client";
import { encryptMetaSecret } from "@/lib/meta/security";
import { sanitizeError } from "@/lib/meta/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENDING_COOKIE = "neura_meta_pending";
const PENDING_TTL_SEC = 15 * 60;

function publicLanding(subpath: string): string {
  const hosts = process.env.NEURA_PUBLIC_HOSTS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const host = hosts[0] || "alquiloya.com.py";
  const q = subpath ? "?" + subpath : "";
  return "https://" + host + "/publico#admin-agent-redes" + q;
}

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

function errorRedirect(msg: string) {
  const url = publicLanding("meta_error=" + encodeURIComponent(msg));
  return NextResponse.redirect(url, 302);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errParam = url.searchParams.get("error");
    if (errParam) return errorRedirect(errParam);
    if (!code || !state) return errorRedirect("missing_code_or_state");

    const jar = await cookies();
    const nonceCookie = jar.get(STATE_COOKIE_NAME)?.value ?? null;
    let payload;
    try {
      payload = verifyState(state, nonceCookie);
    } catch (e) {
      return errorRedirect("invalid_state:" + sanitizeError(e).slice(0, 60));
    }

    // Decodificar owner del pid: "prop:<uuid>" o "agente:<uuid>"
    const encoded = payload.pid;
    let ownerType: "propietario" | "agente";
    let ownerId: string;
    if (encoded.startsWith("agente:")) {
      ownerType = "agente";
      ownerId = encoded.slice("agente:".length);
    } else if (encoded.startsWith("propietario:")) {
      ownerType = "propietario";
      ownerId = encoded.slice("propietario:".length);
    } else if (encoded.startsWith("prop:")) {
      // compat con nombres viejos si aparecen
      ownerType = "propietario";
      ownerId = encoded.slice("prop:".length);
    } else {
      // Compat total: si no tiene prefijo asumimos propietario (Entrega 1 previa)
      ownerType = "propietario";
      ownerId = encoded;
    }

    const redirectUri = process.env.META_REDIRECT_URI?.trim();
    if (!redirectUri) return errorRedirect("server_misconfigured");

    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await upgradeToLongLivedToken(shortLived.access_token);

    let expiresAt: number | null = null;
    let scopes: string[] = [];
    try {
      const dbg = await debugToken(longLived.access_token);
      expiresAt = dbg.data?.expires_at ?? null;
      scopes = dbg.data?.scopes ?? [];
    } catch { /* opcional */ }

    const pages = await listPagesForUser(longLived.access_token);
    const enriched: PendingSelection["pages"] = [];
    for (const p of pages.slice(0, 5)) {
      let igAccountId: string | null = null;
      let igUsername: string | null = null;
      try {
        const info = await getPageInstagramInfo(p.id, p.access_token);
        igAccountId = info.instagram_business_account?.id ?? null;
        if (igAccountId) {
          try {
            const ig = await getIgAccountInfo(igAccountId, p.access_token);
            igUsername = ig.username ?? null;
          } catch { /* opcional */ }
        }
      } catch { /* opcional */ }
      enriched.push({
        id: p.id,
        name: p.name,
        eat_page: encryptMetaSecret(p.access_token),
        instagram_business_account_id: igAccountId,
        instagram_username: igUsername,
      });
    }

    const pending: PendingSelection = {
      owner_type: ownerType,
      owner_id: ownerId,
      eat: encryptMetaSecret(longLived.access_token),
      tex: expiresAt,
      scopes,
      pages: enriched,
    };
    const encodedPending = encryptMetaSecret(JSON.stringify(pending));

    const res = NextResponse.redirect(publicLanding("meta_select=1"), 302);
    res.cookies.set(PENDING_COOKIE, encodedPending, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: PENDING_TTL_SEC,
    });
    res.cookies.set(STATE_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    console.error("[api/integraciones/meta/oauth/callback]", sanitizeError(err));
    return errorRedirect("callback_failed");
  }
}
