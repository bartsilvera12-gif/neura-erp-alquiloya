-- =============================================================================
-- AlquiloYa · Fase 10A — Módulo "Agentes inmobiliarios"
-- Tabla nueva para gestionar propietarios externos que listan propiedades
-- a través de AlquiloYa. Es paralela a `alquiloya.agentes` (que modela a las
-- inmobiliarias/agentes verificados) y NO interfiere con `auth.users` ni con
-- el módulo Usuarios del ERP.
--
-- Idempotente: usa IF NOT EXISTS en tabla, índices y trigger.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

CREATE TABLE IF NOT EXISTS alquiloya.propietarios (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           uuid NOT NULL,
  nombre               text NOT NULL,
  email                text,
  telefono             text,
  documento            text,
  tipo_persona         text,            -- 'fisica' | 'juridica' | otros
  estado               text,            -- libre (ej. 'pendiente', 'verificado', 'baja')
  activo               boolean NOT NULL DEFAULT true,
  usuario_id           uuid,            -- futuro: vínculo con alquiloya.usuarios / auth
  plan_publicacion_id  uuid,            -- futuro: vínculo con alquiloya.planes_publicacion
  observaciones        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS propietarios_empresa_id_idx
  ON alquiloya.propietarios (empresa_id);

CREATE INDEX IF NOT EXISTS propietarios_empresa_nombre_idx
  ON alquiloya.propietarios (empresa_id, lower(nombre));

CREATE INDEX IF NOT EXISTS propietarios_empresa_activo_idx
  ON alquiloya.propietarios (empresa_id, activo);

-- Trigger updated_at (idempotente)
CREATE OR REPLACE FUNCTION alquiloya.propietarios_set_updated_at()
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
    WHERE tgname = 'propietarios_set_updated_at'
      AND tgrelid = 'alquiloya.propietarios'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER propietarios_set_updated_at
             BEFORE UPDATE ON alquiloya.propietarios
             FOR EACH ROW EXECUTE FUNCTION alquiloya.propietarios_set_updated_at()';
  END IF;
END $$;

-- Refrescar cache PostgREST por si alguien expone el schema.
SELECT pg_notify('pgrst', 'reload schema');
