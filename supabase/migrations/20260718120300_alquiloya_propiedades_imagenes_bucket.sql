-- =============================================================================
-- AlquiloYa · Bucket 'propiedades-imagenes' para imagenes publicables en Meta
--
-- Muchas propiedades tienen fotos guardadas como 'data:image/...' base64 en
-- propiedad_fotos.url. Meta Graph API necesita URL HTTPS accesible para
-- publicar. Este bucket es el destino cuando el worker Meta rehostea las
-- imagenes data:URL antes de publicar.
--
-- Bucket publico (Meta necesita GET sin auth). Idempotente.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'propiedades-imagenes',
  'propiedades-imagenes',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
