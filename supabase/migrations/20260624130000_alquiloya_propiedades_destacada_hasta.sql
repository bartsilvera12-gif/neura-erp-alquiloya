-- =============================================================================
-- AlquiloYa · destacada_hasta en propiedades
-- Permite destacar con vencimiento opcional (7/14/30 dias o sin vencimiento).
-- Toda lectura "destacada efectiva" se computa como:
--   destacada = true AND (destacada_hasta IS NULL OR destacada_hasta > now())
-- Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.propiedades
  ADD COLUMN IF NOT EXISTS destacada_hasta timestamptz;

CREATE INDEX IF NOT EXISTS propiedades_destacada_hasta_idx
  ON alquiloya.propiedades (empresa_id, destacada, destacada_hasta);

SELECT pg_notify('pgrst', 'reload schema');
