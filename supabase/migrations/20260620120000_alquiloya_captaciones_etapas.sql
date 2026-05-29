-- =============================================================================
-- AlquiloYa · Fase 13A — Estados operativos de captaciones
-- Tenant-only (schema alquiloya). Reemplaza el CHECK de etapa por los 5 valores
-- operativos. Migra valores legacy en su lugar (idempotente).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='alquiloya' AND c.relname='agente_captaciones'
  ) THEN
    RAISE NOTICE 'agente_captaciones no existe — skip';
    RETURN;
  END IF;

  -- 1. Drop CHECK viejo si existe (idempotente).
  ALTER TABLE alquiloya.agente_captaciones
    DROP CONSTRAINT IF EXISTS agente_captaciones_etapa_chk;

  -- 2. Migrar valores legacy a los nuevos.
  UPDATE alquiloya.agente_captaciones SET etapa = 'contacto'        WHERE etapa = 'contactado';
  UPDATE alquiloya.agente_captaciones SET etapa = 'negocio_activo'  WHERE etapa IN ('en_revision','publicado');
  UPDATE alquiloya.agente_captaciones SET etapa = 'rechazado'       WHERE etapa = 'perdido';

  -- 3. Reaplicar CHECK con los 5 valores operativos.
  ALTER TABLE alquiloya.agente_captaciones
    ADD CONSTRAINT agente_captaciones_etapa_chk
    CHECK (etapa IN ('nuevo','contacto','negocio_activo','cerrado','rechazado'));
END $$;

SELECT pg_notify('pgrst', 'reload schema');
