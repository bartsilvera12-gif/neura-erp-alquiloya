-- =============================================================================
-- AlquiloYa · Fase Publicar-1 — Vínculo propiedad → propietario
-- Tenant-only (schema alquiloya). Permite trazar la propiedad recibida desde
-- la web pública al propietario que la cargó.
-- Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.propiedades
  ADD COLUMN IF NOT EXISTS propietario_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='propiedades_propietario_fk'
  ) AND EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='alquiloya' AND c.relname='propietarios' AND c.relkind='r'
  ) THEN
    ALTER TABLE alquiloya.propiedades
      ADD CONSTRAINT propiedades_propietario_fk
      FOREIGN KEY (propietario_id)
      REFERENCES alquiloya.propietarios(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS propiedades_propietario_idx
  ON alquiloya.propiedades (propietario_id)
  WHERE propietario_id IS NOT NULL;

SELECT pg_notify('pgrst', 'reload schema');
