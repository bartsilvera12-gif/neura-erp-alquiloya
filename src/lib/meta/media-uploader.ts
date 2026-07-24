// Uploader de imagenes de propiedades a Supabase Storage.
// Meta Graph API necesita URL HTTPS accesible; propiedad_fotos.url a veces
// tiene data:image/... base64 (hasta 10 MB) que Meta no puede leer.
//
// resolveMediaUrl(url):
//   - Si ya es http(s): devuelve la URL tal cual.
//   - Si es data:URL: sube al bucket 'propiedades-imagenes' y devuelve el
//     publicUrl HTTPS.
//   - Si es otra cosa: throws.

import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { createHash } from "node:crypto";

const BUCKET = "propiedades-imagenes";

/** Parsea 'data:image/png;base64,AAAA...' -> { mime, buffer }. Throws si es invalido. */
function parseDataUrl(url: string): { mime: string; buffer: Buffer; ext: string } {
  const m = url.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/i);
  if (!m) throw new Error("data URL invalida o mime no permitido");
  const mime = m[1];
  const b64 = m[3];
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length === 0) throw new Error("data URL con payload vacio");
  const ext = mime === "image/jpeg" ? "jpg" : (mime === "image/png" ? "png" : "webp");
  return { mime, buffer, ext };
}

/** Sube el buffer al bucket y devuelve la URL publica HTTPS. */
async function uploadToBucket(
  buffer: Buffer,
  mime: string,
  ext: string,
  hint: string,
): Promise<string> {
  const supabase = createServiceRoleClient();
  // Path deterministico basado en hash del contenido — dedupe entre propiedades
  // con la misma foto (tipico en catalogos con templates).
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const safeHint = hint.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "img";
  const path = "meta/" + safeHint + "-" + hash + "." + ext;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mime,
      upsert: true, // hash igual -> mismo path -> no re-sube
    });
  if (error && !String(error.message || "").toLowerCase().includes("duplicate")) {
    throw new Error("upload a storage fallo: " + error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("no se pudo obtener publicUrl");
  return data.publicUrl;
}

/**
 * Devuelve una URL HTTPS publicable en Meta.
 * @param url  url original de propiedad_fotos.url
 * @param hint  string corto para el filename (ej: inmueble_id.slice(0,8))
 */
export async function resolveMediaUrl(url: string, hint: string): Promise<string> {
  const trimmed = String(url || "").trim();
  if (!trimmed) throw new Error("url vacia");
  if (trimmed.startsWith("http://")) {
    // http (no s) tambien lo aceptamos pero es raro. Mejor rechazar en publisher.
    return trimmed;
  }
  if (trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("data:")) {
    const parsed = parseDataUrl(trimmed);
    return uploadToBucket(parsed.buffer, parsed.mime, parsed.ext, hint);
  }
  throw new Error("formato de URL no soportado: " + trimmed.slice(0, 30));
}
