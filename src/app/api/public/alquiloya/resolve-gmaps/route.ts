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
  const debug: string[] = [];
  try {
    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get("url") || "").trim();
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Falta el parametro url" }, { status: 400 });
    }
    if (!isAllowedHost(raw)) {
      return NextResponse.json({ ok: false, error: "Solo links de Google Maps" }, { status: 400 });
    }
    debug.push(`start url=${raw}`);

    // 1) Probamos parsear la URL directa (por si ya es la larga con coords).
    const direct = parseCoordsFromUrl(raw);
    if (direct) {
      debug.push(`parsed-from-input lat=${direct.lat} lng=${direct.lng}`);
      console.log("[resolve-gmaps]", debug.join(" | "));
      return NextResponse.json({ ok: true, lat: direct.lat, lng: direct.lng });
    }

    // 2) Seguimos el redirect manualmente para capturar el Location header.
    let currentUrl = raw;
    for (let i = 0; i < 6; i++) {
      let res;
      try {
        res = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
            "Accept-Language": "es-PY,es;q=0.9,en;q=0.5",
          },
        });
      } catch (fetchErr) {
        debug.push(`fetch-error i=${i} msg=${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
        console.error("[resolve-gmaps]", debug.join(" | "));
        return NextResponse.json(
          { ok: false, error: "No pudimos contactar a Google Maps", debug: debug.join(" | ") },
          { status: 200 }
        );
      }
      debug.push(`hop${i} status=${res.status} url=${currentUrl.slice(0, 80)}`);

      // Si redirige: tomamos Location y reintentamos.
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) {
          debug.push(`hop${i} no-location-header`);
          break;
        }
        const next = new URL(loc, currentUrl).toString();
        debug.push(`hop${i} -> ${next.slice(0, 80)}`);
        // Probamos parsear la nueva URL antes de seguir (puede tener las coords).
        const fromNext = parseCoordsFromUrl(next);
        if (fromNext) {
          debug.push(`parsed-from-location lat=${fromNext.lat} lng=${fromNext.lng}`);
          console.log("[resolve-gmaps]", debug.join(" | "));
          return NextResponse.json({ ok: true, lat: fromNext.lat, lng: fromNext.lng });
        }
        currentUrl = next;
        continue;
      }

      // Llegamos al destino: parseamos URL final y body HTML.
      const fromFinalUrl = parseCoordsFromUrl(res.url || currentUrl);
      if (fromFinalUrl) {
        debug.push(`parsed-from-final-url lat=${fromFinalUrl.lat} lng=${fromFinalUrl.lng}`);
        console.log("[resolve-gmaps]", debug.join(" | "));
        return NextResponse.json({ ok: true, lat: fromFinalUrl.lat, lng: fromFinalUrl.lng });
      }
      const text = await res.text().catch(() => "");
      debug.push(`hop${i} body-len=${text.length}`);
      const fromBody = parseCoordsFromUrl(text);
      if (fromBody) {
        debug.push(`parsed-from-body lat=${fromBody.lat} lng=${fromBody.lng}`);
        console.log("[resolve-gmaps]", debug.join(" | "));
        return NextResponse.json({ ok: true, lat: fromBody.lat, lng: fromBody.lng });
      }
      debug.push(`hop${i} no-coords-in-body`);
      break;
    }

    console.warn("[resolve-gmaps] no-match", debug.join(" | "));
    return NextResponse.json(
      {
        ok: false,
        error: "No pudimos extraer la ubicación del link",
        debug: debug.join(" | "),
      },
      { status: 200 }
    );
  } catch (err) {
    debug.push(`exception ${err instanceof Error ? err.message : String(err)}`);
    console.error("[resolve-gmaps]", debug.join(" | "));
    return NextResponse.json(
      { ok: false, error: "Error al resolver el link", debug: debug.join(" | ") },
      { status: 500 }
    );
  }
}
