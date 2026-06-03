-- =============================================================================
-- AlquiloYa · Solicitudes de acceso desde el portal/landing public
-- Captura los pedidos "Solicitar acceso" de agentes inmobiliarios y propietarios.
-- El ERP los aprueba o rechaza y, al aprobar, materializa una fila en
-- alquiloya.agentes / alquiloya.propietarios.
-- Idempotente.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

CREATE TABLE IF NOT EXISTS alquiloya.solicitudes_acceso (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('agente','propietario')),
  sub_tipo        text,            -- agente: 'Independiente' | 'Inmobiliaria'. propietario: null
  nombre          text NOT NULL,
  email           text,
  telefono        text,
  empresa         text,            -- razón social/nombre inmobiliaria (si aplica)
  ciudad          text,
  mensaje         text,
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
  motivo_rechazo  text,
  revisado_por    uuid,
  revisado_at     timestamptz,
  resultado_id    uuid,            -- id del agente/propietario creado al aprobar
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solicitudes_acceso_empresa_idx
  ON alquiloya.solicitudes_acceso (empresa_id);
CREATE INDEX IF NOT EXISTS solicitudes_acceso_estado_idx
  ON alquiloya.solicitudes_acceso (empresa_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS solicitudes_acceso_tipo_idx
  ON alquiloya.solicitudes_acceso (empresa_id, tipo);

CREATE OR REPLACE FUNCTION alquiloya.solicitudes_acceso_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'solicitudes_acceso_set_updated_at'
      AND tgrelid = 'alquiloya.solicitudes_acceso'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER solicitudes_acceso_set_updated_at
             BEFORE UPDATE ON alquiloya.solicitudes_acceso
             FOR EACH ROW EXECUTE FUNCTION alquiloya.solicitudes_acceso_set_updated_at()';
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
