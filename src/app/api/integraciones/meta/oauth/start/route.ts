// POST /api/integraciones/meta/oauth/start
// Genera state firmado + cookie nonce y devuelve authorize_url.
// Sirve tanto para propietarios como agentes (el state guarda el ownerId).

import { NextResponse } from "next/server";
import { requireOwnerContext, sanitizeError } from "@/lib/meta/owner";
import { signState, STATE_COOKIE_NAME, STATE_TTL_SECONDS } from "@/lib/meta/state-cookie";
import { buildAuthorizeUrl, REQUIRED_SCOPES } from "@/lib/meta/graph-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ctx = await requireOwnerContext(request);
    if (ctx instanceof NextResponse) return ctx;

    const redirectUri = process.env.META_REDIRECT_URI?.trim();
    if (!redirectUri) {
      return NextResponse.json(
        { error: "META_REDIRECT_URI no configurado en el servidor" },
        { status: 500 },
      );
    }

    // El state guarda ownerId + prefijo del ownerType para reconstruir en callback.
    // Formato del pid: "prop:<uuid>" o "agente:<uuid>".
    const encodedOwner = ctx.ownerType + ":" + ctx.ownerId;
    const { state, nonce } = signState(ctx.authUserId, encodedOwner);
    const authorizeUrl = buildAuthorizeUrl({
      state,
      redirectUri,
      scopes: REQUIRED_SCOPES,
    });

    const res = NextResponse.json({ success: true, authorize_url: authorizeUrl });
    res.cookies.set(STATE_COOKIE_NAME, nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: STATE_TTL_SECONDS,
    });
    return res;
  } catch (err) {
    console.error("[api/integraciones/meta/oauth/start]", sanitizeError(err));
    return NextResponse.json({ error: "No se pudo iniciar la conexion" }, { status: 500 });
  }
}
