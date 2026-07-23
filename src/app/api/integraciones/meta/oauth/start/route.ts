// POST /api/integraciones/meta/oauth/start
// Genera un state firmado one-shot y devuelve la URL de autorizacion de Meta.

import { NextResponse } from "next/server";
import { requirePropietarioContext, sanitizeError } from "@/lib/meta/propietario";
import { signState, STATE_COOKIE_NAME, STATE_TTL_SECONDS } from "@/lib/meta/state-cookie";
import { buildAuthorizeUrl, REQUIRED_SCOPES } from "@/lib/meta/graph-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ctx = await requirePropietarioContext(request);
    if (ctx instanceof NextResponse) return ctx;

    const redirectUri = process.env.META_REDIRECT_URI?.trim();
    if (!redirectUri) {
      return NextResponse.json(
        { error: "META_REDIRECT_URI no configurado en el servidor" },
        { status: 500 },
      );
    }

    const { state, nonce } = signState(ctx.authUserId, ctx.propietarioId);
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
