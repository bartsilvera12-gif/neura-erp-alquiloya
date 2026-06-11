import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/alquiloya/resolve-gmaps?url=<short google maps link>
 *
 * Los links cortos de Google Maps (maps.app.goo.gl, goo.gl/maps) son redirects
 * a la URL larga que SI contiene las coordenadas (@LAT,LNG o !3dLAT!4dLNG).
 * El navegador no puede seguir esos redirects por CORS, asi que el frontend
 * llama a este endpoint que los resuelve server-side y devuelve {lat, lng}.
 *
 * Si el link no se puede resolver (no es un short link, o Google no devuelve
 * coordenadas), devolvemos { ok:false } con razon.
 */

// Mismos parsers que el frontend para no tener que parsear dos veces.
function parseCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  // @LAT,LNG,Z (formato clasico google.com/maps/@...)
  let m = url.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  // !3dLAT!4dLNG (places y pins compartidos)
  m = url.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  // ?q=LAT,LNG / ?ll=LAT,LNG / ?query=LAT,LNG / ?destination=LAT,LNG
  m = url.match(/[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  // Pares "LAT,LNG" sueltos como ultimo recurso (rango valido).
  m = url.match(/(-?\d{1,3}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  if (m) {
    const la = Number(m[1]), ln = Number(m[2]);
    if (Math.abs(la) <= 90 && Math.abs(ln) <= 180) return { lat: la, lng: ln };
  }
  return null;
}

function isAllowedHost(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    // Solo aceptamos hosts de Google Maps para evitar SSRF arbitrario.
    return (
      h === "maps.app.goo.gl" ||
      h === "goo.gl" ||
      h.endsWith(".google.com") ||
      h === "google.com"
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get("url") || "").trim();
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Falta el parametro url" }, { status: 400 });
    }
    if (!isAllowedHost(raw)) {
      return NextResponse.json({ ok: false, error: "Solo links de Google Maps" }, { status: 400 });
    }

    // 1) Probamos parsear la URL directa (por si ya es la larga con coords).
    const direct = parseCoordsFromUrl(raw);
    if (direct) return NextResponse.json({ ok: true, lat: direct.lat, lng: direct.lng });

    // 2) Seguimos el redirect manualmente para capturar el Location header.
    //    fetch() con redirect:'manual' no sigue automaticamente. Iteramos hasta
    //    3 redirects para cubrir cadenas (maps.app.goo.gl -> consent.google.com
    //    -> google.com/maps/... a veces pasan por consent).
    let currentUrl = raw;
    for (let i = 0; i < 5; i++) {
      const res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          // UA "browser" — algunos endpoints de Google devuelven HTML distinto
          // segun el UA. Con un UA tipo Chrome obtenemos la pagina con
          // coordenadas en meta tags / scripts.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
          "Accept-Language": "es-PY,es;q=0.9,en;q=0.5",
        },
      });

      // Si redirige: tomamos Location y reintentamos.
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, currentUrl).toString();
        // Probamos parsear la nueva URL antes de seguir (puede tener las coords).
        const fromNext = parseCoordsFromUrl(next);
        if (fromNext) return NextResponse.json({ ok: true, lat: fromNext.lat, lng: fromNext.lng });
        currentUrl = next;
        continue;
      }

      // Llegamos al destino: parseamos URL final y body HTML.
      const fromFinalUrl = parseCoordsFromUrl(res.url || currentUrl);
      if (fromFinalUrl) {
        return NextResponse.json({ ok: true, lat: fromFinalUrl.lat, lng: fromFinalUrl.lng });
      }
      const text = await res.text().catch(() => "");
      const fromBody = parseCoordsFromUrl(text);
      if (fromBody) {
        return NextResponse.json({ ok: true, lat: fromBody.lat, lng: fromBody.lng });
      }
      break;
    }

    return NextResponse.json(
      { ok: false, error: "No pudimos extraer la ubicacion del link" },
      { status: 200 }
    );
  } catch (err) {
    console.error("[resolve-gmaps]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Error al resolver el link" },
      { status: 500 }
    );
  }
}
