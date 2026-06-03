-- =============================================================================
-- AlquiloYa · Adquisicion de planes — vencimiento + plan en agentes
-- - alquiloya.agentes gana plan_publicacion_id + plan_vencimiento_at (los
--   agentes tambien pueden tener plan pago, antes solo propietarios lo tenian).
-- - alquiloya.propietarios gana plan_vencimiento_at.
-- - El ERP setea estos valores al aprobar una solicitud (acceso o cambio plan)
--   en base al billing del plan: mensual=+30d, anual=+365d, unico=+30d, gratis=null.
-- Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.agentes
  ADD COLUMN IF NOT EXISTS plan_publicacion_id uuid,
  ADD COLUMN IF NOT EXISTS plan_vencimiento_at timestamptz;

ALTER TABLE alquiloya.propietarios
  ADD COLUMN IF NOT EXISTS plan_vencimiento_at timestamptz;

CREATE INDEX IF NOT EXISTS agentes_plan_publicacion_id_idx
  ON alquiloya.agentes (empresa_id, plan_publicacion_id);
CREATE INDEX IF NOT EXISTS propietarios_plan_vencimiento_idx
  ON alquiloya.propietarios (empresa_id, plan_vencimiento_at);
CREATE INDEX IF NOT EXISTS agentes_plan_vencimiento_idx
  ON alquiloya.agentes (empresa_id, plan_vencimiento_at);

SELECT pg_notify('pgrst', 'reload schema');
