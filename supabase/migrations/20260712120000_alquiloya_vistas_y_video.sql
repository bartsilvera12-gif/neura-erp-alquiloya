-- =============================================================================
-- AlquiloYa · contador de vistas por propiedad + video para agentes premium
--
-- 1) propiedades.vistas_count int    -> contador acumulado de vistas publicas
-- 2) propiedades.ultima_vista_at     -> timestamp de la ultima vista
-- 3) propiedades.video_url text      -> URL de video (YouTube/Vimeo/mp4)
-- 4) planes_publicacion.permite_videos boolean -> flag por plan
--
-- Todo idempotente con ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE alquiloya.propiedades
  ADD COLUMN IF NOT EXISTS vistas_count integer NOT NULL DEFAULT 0;

ALTER TABLE alquiloya.propiedades
  ADD COLUMN IF NOT EXISTS ultima_vista_at timestamptz;

ALTER TABLE alquiloya.propiedades
  ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE alquiloya.planes_publicacion
  ADD COLUMN IF NOT EXISTS permite_videos boolean NOT NULL DEFAULT false;

-- Index para ordenar por vistas (top propiedades mas vistas)
CREATE INDEX IF NOT EXISTS propiedades_vistas_count_idx
  ON alquiloya.propiedades (empresa_id, vistas_count DESC)
  WHERE activo = true AND visible_web = true;
