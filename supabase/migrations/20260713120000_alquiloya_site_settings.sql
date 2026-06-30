-- =============================================================================
-- AlquiloYa · site_settings
-- Tabla key-value para contenido editable desde el ERP que se renderiza en
-- distintas paginas publicas (T&C, "Como funciona", banners, etc.).
-- =============================================================================

CREATE TABLE IF NOT EXISTS alquiloya.site_settings (
  empresa_id  uuid NOT NULL,
  key         text NOT NULL,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, key)
);

CREATE OR REPLACE FUNCTION alquiloya.site_settings_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'site_settings_set_updated_at'
      AND tgrelid = 'alquiloya.site_settings'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER site_settings_set_updated_at
             BEFORE UPDATE ON alquiloya.site_settings
             FOR EACH ROW EXECUTE FUNCTION alquiloya.site_settings_set_updated_at()';
  END IF;
END $$;
