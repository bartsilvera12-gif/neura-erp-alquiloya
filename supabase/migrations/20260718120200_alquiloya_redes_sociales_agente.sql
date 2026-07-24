-- =============================================================================
-- AlquiloYa · Redes sociales tambien para agentes (no solo propietarios)
--
-- Extension de las tablas propietario_redes_sociales y publicaciones_sociales
-- para que agentes inmobiliarios (alquiloya.agentes) tambien puedan tener
-- conexiones Meta y publicaciones asociadas.
--
-- Regla de negocio: cada fila pertenece a UN owner (propietario XOR agente).
-- Un usuario en alquiloya.usuarios tiene o propietario_id o agente_id, nunca ambos.
--
-- Cambios:
--   1) Agregar columna agente_id.
--   2) propietario_id pasa a NULLABLE.
--   3) CHECK XOR entre propietario_id y agente_id (exactamente uno).
--   4) Actualizar unique index / indices que usan propietario_id.
--
-- Idempotente. Append-only (no borra columnas).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tabla 1: propietario_redes_sociales (mantenemos el nombre por append-only)
-- ---------------------------------------------------------------------------
ALTER TABLE alquiloya.propietario_redes_sociales
  ADD COLUMN IF NOT EXISTS agente_id uuid;

-- Drop NOT NULL en propietario_id (idempotente via bloque)
DO $$ BEGIN
  ALTER TABLE alquiloya.propietario_redes_sociales
    ALTER COLUMN propietario_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- CHECK XOR: exactamente uno de los dos debe estar seteado
DO $$ BEGIN
  ALTER TABLE alquiloya.propietario_redes_sociales
    ADD CONSTRAINT propietario_redes_sociales_owner_xor_chk
    CHECK (
      (propietario_id IS NOT NULL AND agente_id IS NULL) OR
      (propietario_id IS NULL AND agente_id IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Nuevo unique index que incluye agente_id. El anterior (solo propietario_id)
-- queda; el nuevo lo complementa. Ambos idempotentes.
CREATE UNIQUE INDEX IF NOT EXISTS propietario_redes_sociales_owner_target_uk
  ON alquiloya.propietario_redes_sociales (
    empresa_id,
    COALESCE(propietario_id, agente_id),
    provider,
    COALESCE(facebook_page_id, ''),
    COALESCE(instagram_account_id, '')
  );

CREATE INDEX IF NOT EXISTS propietario_redes_sociales_agente_idx
  ON alquiloya.propietario_redes_sociales (empresa_id, agente_id)
  WHERE agente_id IS NOT NULL;

COMMENT ON COLUMN alquiloya.propietario_redes_sociales.agente_id IS
  'Si esta seteado (y propietario_id NULL), la conexion pertenece a un agente inmobiliario.';

-- ---------------------------------------------------------------------------
-- Tabla 2: publicaciones_sociales
-- ---------------------------------------------------------------------------
ALTER TABLE alquiloya.publicaciones_sociales
  ADD COLUMN IF NOT EXISTS agente_id uuid;

DO $$ BEGIN
  ALTER TABLE alquiloya.publicaciones_sociales
    ALTER COLUMN propietario_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alquiloya.publicaciones_sociales
    ADD CONSTRAINT publicaciones_sociales_owner_xor_chk
    CHECK (
      (propietario_id IS NOT NULL AND agente_id IS NULL) OR
      (propietario_id IS NULL AND agente_id IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS publicaciones_sociales_agente_idx
  ON alquiloya.publicaciones_sociales (empresa_id, agente_id, created_at DESC)
  WHERE agente_id IS NOT NULL;

COMMENT ON COLUMN alquiloya.publicaciones_sociales.agente_id IS
  'Si esta seteado (y propietario_id NULL), el job pertenece a un agente inmobiliario.';
