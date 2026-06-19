-- =============================================================================
-- AlquiloYa · alquiloya.agente_resenas — destacada_home
-- Permite seleccionar que reseñas aprobadas se muestran en el home publico.
-- Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.agente_resenas
  ADD COLUMN IF NOT EXISTS destacada_home boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS agente_resenas_destacada_home_idx
  ON alquiloya.agente_resenas (empresa_id, destacada_home, created_at DESC)
  WHERE destacada_home = true AND estado = 'aprobada';

SELECT pg_notify('pgrst', 'reload schema');
