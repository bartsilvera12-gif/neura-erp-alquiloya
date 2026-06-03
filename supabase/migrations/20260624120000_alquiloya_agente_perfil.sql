-- =============================================================================
-- AlquiloYa · Perfil público del agente — datos reales completos
-- - Columnas nuevas en `alquiloya.agentes`: verificado, nivel, idiomas,
--   tiempo_respuesta, tasa_respuesta.
-- - Tablas nuevas:
--   * agente_zonas: ciudades/barrios que cubre cada agente.
--   * agente_tips:  tips de zona que el agente escribe (texto libre).
--   * agente_resenas: reseñas con flujo de moderación (pendiente/aprobada/rechazada).
-- Idempotente.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

-- Columnas extra en `agentes`
ALTER TABLE alquiloya.agentes ADD COLUMN IF NOT EXISTS verificado boolean NOT NULL DEFAULT false;
ALTER TABLE alquiloya.agentes ADD COLUMN IF NOT EXISTS nivel text;          -- override manual: 'Junior'|'Pro'|'Top Pro'
ALTER TABLE alquiloya.agentes ADD COLUMN IF NOT EXISTS idiomas text;        -- ej. 'Es · Gn · En'
ALTER TABLE alquiloya.agentes ADD COLUMN IF NOT EXISTS tiempo_respuesta text;  -- ej. '~ 12 min'
ALTER TABLE alquiloya.agentes ADD COLUMN IF NOT EXISTS tasa_respuesta text;    -- ej. '98%'

-- Zonas cubiertas por el agente
CREATE TABLE IF NOT EXISTS alquiloya.agente_zonas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  agente_id   uuid NOT NULL REFERENCES alquiloya.agentes(id) ON DELETE CASCADE,
  ciudad      text NOT NULL,
  barrio      text,
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agente_zonas_agente_idx
  ON alquiloya.agente_zonas (empresa_id, agente_id, orden);

-- Tips/recomendaciones de zona escritas por el agente
CREATE TABLE IF NOT EXISTS alquiloya.agente_tips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  agente_id   uuid NOT NULL REFERENCES alquiloya.agentes(id) ON DELETE CASCADE,
  zona        text,
  titulo      text NOT NULL,
  body        text NOT NULL,
  orden       integer NOT NULL DEFAULT 0,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agente_tips_agente_idx
  ON alquiloya.agente_tips (empresa_id, agente_id, activo, orden);

-- Reseñas con moderación
CREATE TABLE IF NOT EXISTS alquiloya.agente_resenas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  agente_id       uuid NOT NULL REFERENCES alquiloya.agentes(id) ON DELETE CASCADE,
  autor_nombre    text NOT NULL,
  autor_email     text,
  autor_telefono  text,
  rol             text,             -- 'Inquilino'|'Propietario'|'Otro'
  stars           integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body            text NOT NULL,
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
  motivo_rechazo  text,
  revisado_por    uuid,
  revisado_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agente_resenas_agente_idx
  ON alquiloya.agente_resenas (empresa_id, agente_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS agente_resenas_estado_idx
  ON alquiloya.agente_resenas (empresa_id, estado, created_at DESC);

-- Trigger updated_at compartido
CREATE OR REPLACE FUNCTION alquiloya.agente_resenas_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'agente_resenas_set_updated_at'
      AND tgrelid = 'alquiloya.agente_resenas'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER agente_resenas_set_updated_at
             BEFORE UPDATE ON alquiloya.agente_resenas
             FOR EACH ROW EXECUTE FUNCTION alquiloya.agente_resenas_set_updated_at()';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'agente_tips_set_updated_at'
      AND tgrelid = 'alquiloya.agente_tips'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER agente_tips_set_updated_at
             BEFORE UPDATE ON alquiloya.agente_tips
             FOR EACH ROW EXECUTE FUNCTION alquiloya.agente_resenas_set_updated_at()';
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
