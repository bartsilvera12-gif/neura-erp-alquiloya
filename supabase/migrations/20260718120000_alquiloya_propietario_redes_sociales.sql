-- =============================================================================
-- AlquiloYa · Cuentas de redes sociales conectadas por propietario (Meta)
-- Los tokens SIEMPRE se guardan cifrados con AES-256-GCM (src/lib/meta/security.ts).
-- Append-only + idempotente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS alquiloya.propietario_redes_sociales (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             uuid NOT NULL,
  propietario_id         uuid NOT NULL,
  provider               text NOT NULL DEFAULT 'meta',
  facebook_page_id       text,
  instagram_account_id   text,
  account_name           text,
  username               text,
  access_token_encrypted text NOT NULL,
  token_expires_at       timestamptz,
  scopes                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  status                 text NOT NULL DEFAULT 'connected',
  auto_publish_facebook  boolean NOT NULL DEFAULT false,
  auto_publish_instagram boolean NOT NULL DEFAULT false,
  last_validated_at      timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE alquiloya.propietario_redes_sociales
    ADD CONSTRAINT propietario_redes_sociales_status_chk
    CHECK (status IN ('connected','expired','revoked','error'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS propietario_redes_sociales_unique_target_idx
  ON alquiloya.propietario_redes_sociales (
    empresa_id,
    propietario_id,
    provider,
    COALESCE(facebook_page_id, ''),
    COALESCE(instagram_account_id, '')
  );

CREATE INDEX IF NOT EXISTS propietario_redes_sociales_propietario_idx
  ON alquiloya.propietario_redes_sociales (empresa_id, propietario_id);

CREATE INDEX IF NOT EXISTS propietario_redes_sociales_status_idx
  ON alquiloya.propietario_redes_sociales (empresa_id, status);

COMMENT ON TABLE alquiloya.propietario_redes_sociales IS
  'Conexiones OAuth de propietarios con Facebook Page e Instagram Business/Creator (Meta).';
