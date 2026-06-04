import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";

export function extractBearerTokenFromRequest(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  const t = h.slice(7).trim();
  return t || null;
}

/**
 * Feature flag opt-in: validar el access token localmente (firma + exp) en vez de
 * pegarle a `/auth/v1/user` de Supabase Auth en cada request.
 *
 * - OFF (default): comportamiento idéntico al histórico (`auth.getUser()` remoto).
 *   Seguro para todos los tenants que comparten este helper.
 * - ON (`NEURA_USE_LOCAL_JWT=1`): se intenta verificar local; ante CUALQUIER falla
 *   (sin clave configurada, firma inválida, token expirado) cae al path remoto.
 *
 * Requiere una de:
 * - `SUPABASE_JWT_SECRET` (proyectos con JWT simétrico HS256), o
 * - JWKS asimétrico en `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (jose lo cachea).
 */
function isLocalJwtEnabled(): boolean {
  return process.env.NEURA_USE_LOCAL_JWT?.trim() === "1";
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
function getProjectJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  if (jwksCache) return jwksCache;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  // `createRemoteJWKSet` cachea el JWKS en memoria con cooldown propio (~10 min) y
  // refresca solo ante un `kid` desconocido. Evita una descarga por request.
  jwksCache = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  return jwksCache;
}

/** Construye un `User` mínimo (los campos que consume el resto del ERP) desde los claims verificados. */
function userFromVerifiedClaims(payload: JWTPayload): User | null {
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) return null;
  const userMetadata =
    (payload.user_metadata as Record<string, unknown> | undefined) ?? {};
  const appMetadata =
    (payload.app_metadata as Record<string, unknown> | undefined) ?? {};
  return {
    id: sub,
    aud: typeof payload.aud === "string" ? payload.aud : "authenticated",
    role: typeof payload.role === "string" ? payload.role : undefined,
    email: typeof payload.email === "string" ? payload.email : undefined,
    phone: typeof payload.phone === "string" ? payload.phone : undefined,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
    created_at: "",
  } as unknown as User;
}

/** Verifica firma + expiración del access token sin round-trip de red. `null` si no se puede validar. */
async function verifyAccessTokenLocally(token: string): Promise<User | null> {
  try {
    const secret = process.env.SUPABASE_JWT_SECRET?.trim();
    if (secret) {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        { algorithms: ["HS256"] }
      );
      return userFromVerifiedClaims(payload);
    }
    const jwks = getProjectJwks();
    if (jwks) {
      const { payload } = await jwtVerify(token, jwks);
      return userFromVerifiedClaims(payload);
    }
    return null; // ni secret ni JWKS configurado: no podemos validar local
  } catch {
    return null; // firma/exp inválida → el caller hace fallback remoto
  }
}

/**
 * Usuario de Auth para Route Handlers: JWT en header o cookies.
 * Solo NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (sin db.schema en getUser).
 */
export async function getAuthUserForApiRoute(request: Request): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  const localJwt = isLocalJwtEnabled();
  const bearer = extractBearerTokenFromRequest(request);

  // ── Fast path opt-in: bearer en header, verificado localmente ──
  if (localJwt && bearer) {
    const localUser = await verifyAccessTokenLocally(bearer);
    if (localUser) return localUser;
    // si falla, continúa al path remoto de abajo
  }

  if (bearer) {
    const c = createClient(url, anonKey);
    const { data, error } = await c.auth.getUser(bearer);
    if (!error && data.user?.id) return data.user;
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  // ── Fast path opt-in: sesión por cookie. `getSession()` decodifica la cookie sin red;
  //     verificamos su firma localmente. Ante falla, cae al `getUser()` remoto de abajo. ──
  if (localJwt) {
    const { data: sessionData } = await supabaseAuth.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      const localUser = await verifyAccessTokenLocally(token);
      if (localUser) return localUser;
    }
  }

  const { data, error } = await supabaseAuth.auth.getUser();
  if (!error && data.user?.id) return data.user;
  return null;
}
