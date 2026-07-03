import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión Supabase en cookies antes de Route Handlers / RSC.
 * Solo NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (sin db.schema en getUser).
 */
/**
 * Lista de hosts considerados "web pública AlquiloYa" (env-driven, sin hardcode).
 * Formato: coma-separados, ej. "alquiloya.com.py,www.alquiloya.com.py".
 */
function getPublicHosts(): string[] {
  const raw = process.env.NEURA_PUBLIC_HOSTS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
}

/** Hostname normalizado del request (sin puerto, lowercase). */
function getRequestHostname(request: NextRequest): string {
  const hostHeader = request.headers.get("host") ?? "";
  return hostHeader.split(":")[0].trim().toLowerCase();
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicHosts = getPublicHosts();
  const host = getRequestHostname(request);

  // Canonical redirect: si el request llega a un host NO publico (ej.
  // alquiloya.neura.com.py) pero apunta a una ruta que es de la web publica,
  // redirigimos al primer host publico configurado (el dominio corto).
  // Rutas afectadas: /publico, /alquiloya-legacy/*, /r/*, /portal-agentes.
  if (publicHosts.length > 0 && !publicHosts.includes(host)) {
    const isPublicRoute =
      pathname === "/publico" ||
      pathname.startsWith("/alquiloya-legacy/") ||
      pathname.startsWith("/r/") ||
      pathname === "/portal-agentes";
    if (isPublicRoute) {
      const canonicalHost = publicHosts[0];
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.hostname = canonicalHost;
      redirectUrl.protocol = "https:";
      redirectUrl.port = "";
      if (pathname === "/alquiloya-legacy/index.html") {
        redirectUrl.pathname = "/publico";
      }
      return NextResponse.redirect(redirectUrl, 302);
    }
  }

  // Host-aware: si el request viene de un dominio publico configurado y apunta a la raiz,
  // se reescribe a la web legacy estatica. Solo afecta "/" (no /api, /_next, /dashboard, etc.).
  if (publicHosts.length > 0 && (pathname === "/" || pathname === "")) {
    if (publicHosts.includes(host)) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = "/alquiloya-legacy/index.html";
      return NextResponse.rewrite(rewriteUrl);
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}

/**
 * Excluir `/api/webhooks/*`: Meta hace GET sin cookies para verificar el webhook;
 * no debe pasar por refresh de sesión Supabase (y queda listo para proxies estrictos).
 */
export const config = {
  matcher: [
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico|alquiloya-legacy/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
