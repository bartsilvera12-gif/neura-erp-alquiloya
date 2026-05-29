-- =============================================================================
-- AlquiloYa · Fase 12A — Captaciones (asesoría de agente para propietarios)
-- Idempotente. No crea triggers de pago/comisión.
-- =============================================================================

CREATE TABLE IF NOT EXISTS alquiloya.agente_captaciones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL,
  agente_id             uuid NOT NULL
                        REFERENCES alquiloya.agentes(id) ON DELETE RESTRICT,
  propietario_nombre    text,
  propietario_email     text,
  propietario_telefono  text,
  propiedad_titulo      text,
  tipo_propiedad        text,
  ciudad                text,
  barrio                text,
  direccion             text,
  precio_estimado       numeric(14,2),
  mensaje               text,
  etapa                 text NOT NULL DEFAULT 'nuevo',
  estado                text NOT NULL DEFAULT 'abierto',
  origen                text NOT NULL DEFAULT 'web_publica',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agente_captaciones_etapa_chk CHECK (
    etapa IN ('nuevo','contactado','en_revision','publicado','cerrado','perdido')
  ),
  CONSTRAINT agente_captaciones_estado_chk CHECK (
    estado IN ('abierto','cerrado','perdido','en_pausa')
  )
);

CREATE INDEX IF NOT EXISTS agente_captaciones_empresa_idx
  ON alquiloya.agente_captaciones (empresa_id);
CREATE INDEX IF NOT EXISTS agente_captaciones_agente_idx
  ON alquiloya.agente_captaciones (agente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agente_captaciones_etapa_idx
  ON alquiloya.agente_captaciones (empresa_id, etapa);

CREATE OR REPLACE FUNCTION alquiloya.agente_captaciones_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='agente_captaciones_set_updated_at'
      AND tgrelid='alquiloya.agente_captaciones'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER agente_captaciones_set_updated_at
             BEFORE UPDATE ON alquiloya.agente_captaciones
             FOR EACH ROW EXECUTE FUNCTION alquiloya.agente_captaciones_set_updated_at()';
  END IF;
END $$;

-- RLS: mismo patrón que agentes/propiedades.
ALTER TABLE alquiloya.agente_captaciones ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE has_fn boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='alquiloya' AND p.proname='puede_acceder_empresa'
  ) INTO has_fn;
  IF has_fn THEN
    DROP POLICY IF EXISTS agente_captaciones_select ON alquiloya.agente_captaciones;
    CREATE POLICY agente_captaciones_select ON alquiloya.agente_captaciones
      FOR SELECT USING (alquiloya.puede_acceder_empresa(empresa_id));
    DROP POLICY IF EXISTS agente_captaciones_insert ON alquiloya.agente_captaciones;
    CREATE POLICY agente_captaciones_insert ON alquiloya.agente_captaciones
      FOR INSERT WITH CHECK (alquiloya.puede_acceder_empresa(empresa_id));
    DROP POLICY IF EXISTS agente_captaciones_update ON alquiloya.agente_captaciones;
    CREATE POLICY agente_captaciones_update ON alquiloya.agente_captaciones
      FOR UPDATE USING (alquiloya.puede_acceder_empresa(empresa_id))
      WITH CHECK (alquiloya.puede_acceder_empresa(empresa_id));
    DROP POLICY IF EXISTS agente_captaciones_delete ON alquiloya.agente_captaciones;
    CREATE POLICY agente_captaciones_delete ON alquiloya.agente_captaciones
      FOR DELETE USING (alquiloya.puede_acceder_empresa(empresa_id));
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
