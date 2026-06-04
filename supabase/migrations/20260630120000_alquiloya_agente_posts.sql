-- =============================================================================
-- AlquiloYa · alquiloya.agente_posts
-- Mini-CMS: posts del blog por agente, visibles en su perfil publico.
-- Idempotente.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

CREATE TABLE IF NOT EXISTS alquiloya.agente_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  agente_id     uuid NOT NULL,
  slug          text NOT NULL,
  titulo        text NOT NULL,
  resumen       text,
  contenido     text,
  cover_url     text,
  publicado     boolean NOT NULL DEFAULT false,
  destacado     boolean NOT NULL DEFAULT false,
  orden         int NOT NULL DEFAULT 0,
  publicado_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, agente_id, slug)
);

CREATE INDEX IF NOT EXISTS agente_posts_agente_idx
  ON alquiloya.agente_posts (empresa_id, agente_id, publicado, orden ASC, publicado_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS agente_posts_publicado_idx
  ON alquiloya.agente_posts (empresa_id, publicado, publicado_at DESC NULLS LAST)
  WHERE publicado = true;

CREATE OR REPLACE FUNCTION alquiloya.agente_posts_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  -- Si pasa a publicado por primera vez, fijamos publicado_at.
  IF NEW.publicado = true AND (OLD.publicado IS DISTINCT FROM true) AND NEW.publicado_at IS NULL THEN
    NEW.publicado_at := now();
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'agente_posts_set_updated_at'
      AND tgrelid = 'alquiloya.agente_posts'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER agente_posts_set_updated_at
             BEFORE UPDATE ON alquiloya.agente_posts
             FOR EACH ROW EXECUTE FUNCTION alquiloya.agente_posts_set_updated_at()';
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
