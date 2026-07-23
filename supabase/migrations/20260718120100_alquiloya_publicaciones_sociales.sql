-- =============================================================================
-- AlquiloYa · Jobs de publicacion social (Facebook / Instagram)
-- Una fila = un job para publicar UNA propiedad en UNA red.
-- El worker toma filas 'pending' con lock SKIP LOCKED (Entrega 2).
-- Idempotencia via idempotency_key. Append-only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS alquiloya.publicaciones_sociales (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL,
  propietario_id          uuid NOT NULL,
  inmueble_id             uuid NOT NULL,
  social_account_id       uuid,
  network                 text NOT NULL,
  status                  text NOT NULL DEFAULT 'pending',
  caption                 text,
  media_urls              jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_container_id   text,
  external_post_id        text,
  external_post_url       text,
  attempt_count           int  NOT NULL DEFAULT 0,
  next_retry_at           timestamptz,
  last_error_code         text,
  last_error_message      text,
  published_at            timestamptz,
  idempotency_key         text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE alquiloya.publicaciones_sociales
    ADD CONSTRAINT publicaciones_sociales_status_chk
    CHECK (status IN ('pending','processing','published','failed','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alquiloya.publicaciones_sociales
    ADD CONSTRAINT publicaciones_sociales_network_chk
    CHECK (network IN ('facebook','instagram'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS publicaciones_sociales_idempotency_uk
  ON alquiloya.publicaciones_sociales (empresa_id, idempotency_key);

CREATE INDEX IF NOT EXISTS publicaciones_sociales_worker_pick_idx
  ON alquiloya.publicaciones_sociales (status, next_retry_at, created_at)
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS publicaciones_sociales_admin_list_idx
  ON alquiloya.publicaciones_sociales (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS publicaciones_sociales_propietario_idx
  ON alquiloya.publicaciones_sociales (empresa_id, propietario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS publicaciones_sociales_inmueble_idx
  ON alquiloya.publicaciones_sociales (empresa_id, inmueble_id);

COMMENT ON TABLE alquiloya.publicaciones_sociales IS
  'Jobs (uno por inmueble+red) para publicar en Facebook/Instagram via Meta Graph API.';
COMMENT ON COLUMN alquiloya.publicaciones_sociales.idempotency_key IS
  'Formato: prop:{inmueble_id}:net:{fb|ig}:v1 — evita duplicar jobs por doble clic.';
