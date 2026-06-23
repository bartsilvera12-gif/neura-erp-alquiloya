-- =============================================================================
-- AlquiloYa · alquiloya.propiedades — aprobada_at
-- Marca el momento de la primera (o ultima) aprobacion. Sirve para distinguir
-- propiedades nuevas pendientes vs. propiedades ya aprobadas que un agente
-- volvio a editar y deben re-moderar.
-- Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.propiedades
  ADD COLUMN IF NOT EXISTS aprobada_at timestamptz;

CREATE INDEX IF NOT EXISTS propiedades_aprobada_at_idx
  ON alquiloya.propiedades (empresa_id, aprobada_at)
  WHERE aprobada_at IS NOT NULL;

SELECT pg_notify('pgrst', 'reload schema');
