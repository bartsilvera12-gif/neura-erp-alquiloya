// Generador de captions para publicaciones sociales.
// Desacoplado y testeable: solo pura funcion de datos -> string.
// El worker le pasa los datos de la propiedad; devuelve el texto listo.
// NO inventa datos ausentes: si algo esta null, lo omite del texto.

export type PropiedadCaptionData = {
  titulo: string | null;
  descripcion?: string | null;
  operacion?: string | null;         // 'alquiler' | 'venta' | 'temporal'
  tipo?: string | null;              // 'depto' | 'casa' | ...
  ciudad?: string | null;
  barrio?: string | null;
  direccion?: string | null;
  precio?: number | null;
  moneda?: string | null;            // 'PYG' | 'USD' | ...
  precio_periodo?: string | null;    // 'mensual' | 'noche' | ...
  dormitorios?: number | null;
  banos?: number | null;
  cocheras?: number | null;
  superficie_m2?: number | null;
  codigo?: string | null;
  publicUrl?: string | null;         // deep-link a la ficha
};

export type CaptionOptions = {
  maxLength?: number;                // 2000 por defecto (limite FB)
  hashtags?: string[];               // ['#alquilerpy', '#inmuebles', ...]
};

const DEFAULT_MAX = 2000;
const DEFAULT_HASHTAGS = ["#AlquiloYa", "#Paraguay", "#InmueblesPY"];

function formatMoney(precio: number | null | undefined, moneda: string | null | undefined): string | null {
  if (typeof precio !== "number" || !isFinite(precio) || precio <= 0) return null;
  const mon = (moneda || "PYG").toUpperCase();
  if (mon === "PYG" || mon === "GS") {
    try {
      return "Gs. " + new Intl.NumberFormat("es-PY").format(precio);
    } catch {
      return "Gs. " + precio.toFixed(0);
    }
  }
  if (mon === "USD") {
    return "USD " + precio.toFixed(0);
  }
  return mon + " " + precio.toFixed(0);
}

function ubicacion(p: PropiedadCaptionData): string | null {
  const parts = [p.barrio, p.ciudad].filter(function (x) { return !!x && String(x).trim() !== ""; });
  if (parts.length === 0) return null;
  return "📍 " + parts.join(", ");
}

function operacionLabel(op: string | null | undefined): string | null {
  if (!op) return null;
  const o = String(op).toLowerCase();
  if (o === "alquiler") return "En alquiler";
  if (o === "venta") return "En venta";
  if (o === "temporal") return "Alquiler temporal";
  return null;
}

function features(p: PropiedadCaptionData): string {
  const parts: string[] = [];
  if (typeof p.dormitorios === "number" && p.dormitorios > 0) {
    parts.push(p.dormitorios + " " + (p.dormitorios === 1 ? "dormitorio" : "dormitorios"));
  }
  if (typeof p.banos === "number" && p.banos > 0) {
    parts.push(p.banos + " " + (p.banos === 1 ? "baño" : "baños"));
  }
  if (typeof p.cocheras === "number" && p.cocheras > 0) {
    parts.push(p.cocheras + " " + (p.cocheras === 1 ? "cochera" : "cocheras"));
  }
  if (typeof p.superficie_m2 === "number" && p.superficie_m2 > 0) {
    parts.push(p.superficie_m2 + " m²");
  }
  if (parts.length === 0) return "";
  return "🏠 " + parts.join(" · ");
}

/** Compone el caption. Sin datos faltantes inventados. */
export function generateCaption(
  p: PropiedadCaptionData,
  opts: CaptionOptions = {},
): string {
  const max = opts.maxLength ?? DEFAULT_MAX;
  const hashtags = opts.hashtags && opts.hashtags.length > 0 ? opts.hashtags : DEFAULT_HASHTAGS;

  const lines: string[] = [];

  // Titulo (primera linea, en negrita simulada con MAYUS o solo tal cual)
  const titulo = (p.titulo || "").trim();
  if (titulo) lines.push(titulo);

  // Operacion + precio en la misma linea
  const opLine: string[] = [];
  const opLabel = operacionLabel(p.operacion);
  if (opLabel) opLine.push(opLabel);
  const priceStr = formatMoney(p.precio, p.moneda);
  if (priceStr) {
    const periodo = p.precio_periodo ? " / " + p.precio_periodo : "";
    opLine.push("💰 " + priceStr + periodo);
  }
  if (opLine.length > 0) lines.push(opLine.join(" · "));

  // Ubicacion
  const loc = ubicacion(p);
  if (loc) lines.push(loc);

  // Features
  const feat = features(p);
  if (feat) lines.push(feat);

  // Descripcion (limitada)
  if (p.descripcion) {
    const desc = String(p.descripcion).trim();
    if (desc) {
      lines.push("");
      lines.push(desc.length > 400 ? desc.slice(0, 397) + "..." : desc);
    }
  }

  // Link a la ficha
  if (p.publicUrl) {
    lines.push("");
    lines.push("👉 Ver mas: " + p.publicUrl);
  }

  // Codigo interno (chico, al final)
  if (p.codigo) {
    lines.push("");
    lines.push("Codigo: " + p.codigo);
  }

  // Hashtags
  if (hashtags.length > 0) {
    lines.push("");
    lines.push(hashtags.join(" "));
  }

  let out = lines.join("\n");
  if (out.length > max) {
    out = out.slice(0, max - 3) + "...";
  }
  return out;
}
