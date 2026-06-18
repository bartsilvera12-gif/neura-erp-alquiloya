-- =============================================================================
-- AlquiloYa — Facturación + SIFEN (schema alquiloya)
-- Migración 100% aditiva e idempotente. NO toca public ni zentra_erp.
-- =============================================================================
--   Crea / asegura:
--     alquiloya.facturas
--     alquiloya.factura_items
--     alquiloya.empresa_sifen_config
--     alquiloya.factura_electronica
--     alquiloya.factura_electronica_evento
--     alquiloya.nota_credito
--     alquiloya.nota_credito_electronica
--     alquiloya.nota_credito_evento
--
--   Columnas acumulativas (mismas que las migrations canónicas de zentra_erp):
--     certificado_password_encrypted, direccion_fiscal,
--     timbrado_fecha_inicio_vigencia, timbrado_fecha_fin_vigencia,
--     actividad_economica_codigo/descripcion, kude_logo_path / colores,
--     sifen_plazo_cancelacion_horas, sifen_aprobado_at, sifen_cancelado_at,
--     sifen_cancelacion_motivo, xml_firmado_path, kuDE_url, qr_data,
--     sifen_d_prot_cons_lote, sifen_ultima_respuesta_recibe_lote,
--     sifen_ultima_respuesta_consulta_lote, sifen_regeneracion_seq,
--     plus toda la cobertura de constraints y estado_sifen vigente.
--
--   FKs solo a tablas locales de alquiloya. empresa_id se almacena como uuid
--   plano (catalogo de empresas vive en public; no lo tocamos, lo filtra el
--   server con NEURA_CLIENT_EMPRESA_ID/ALQUILOYA_EMPRESA_ID).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

-- Trigger helper local del schema (igual semantica que public.set_updated_at).
CREATE OR REPLACE FUNCTION alquiloya.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

-- -----------------------------------------------------------------------------
-- 1. FACTURAS  (cabecera) + FACTURA_ITEMS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.facturas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL,
  cliente_id         uuid,
  numero_factura     text NOT NULL,
  fecha              date NOT NULL DEFAULT current_date,
  fecha_vencimiento  date NOT NULL DEFAULT current_date,
  monto              numeric NOT NULL DEFAULT 0,
  saldo              numeric NOT NULL DEFAULT 0,
  estado             text NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pagado', 'Pendiente', 'Vencido', 'Anulado')),
  tipo               text NOT NULL DEFAULT 'contado'
    CHECK (tipo IN ('contado', 'credito', 'suscripcion')),
  moneda             text NOT NULL DEFAULT 'GS'
    CHECK (moneda IN ('GS', 'USD')),
  -- Datos fiscales propios (sin cliente_id real obligatorio).
  cliente_razon_social text,
  cliente_ruc          text,
  observaciones        text,
  -- Origen / linkeo a venta (puente Venta -> Factura).
  origen_venta_id    uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_empresa_numero
  ON alquiloya.facturas (empresa_id, numero_factura);
CREATE INDEX IF NOT EXISTS idx_facturas_empresa ON alquiloya.facturas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente ON alquiloya.facturas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha   ON alquiloya.facturas (fecha);

DROP TRIGGER IF EXISTS facturas_set_updated_at ON alquiloya.facturas;
CREATE TRIGGER facturas_set_updated_at
  BEFORE UPDATE ON alquiloya.facturas
  FOR EACH ROW EXECUTE FUNCTION alquiloya.set_updated_at();

CREATE TABLE IF NOT EXISTS alquiloya.factura_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  factura_id      uuid NOT NULL REFERENCES alquiloya.facturas(id) ON DELETE CASCADE,
  descripcion     text NOT NULL,
  cantidad        numeric NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL DEFAULT 0,
  subtotal        numeric NOT NULL DEFAULT 0,
  iva             numeric NOT NULL DEFAULT 0,
  tipo_iva        text NOT NULL DEFAULT '10%'
    CHECK (tipo_iva IN ('EXENTA', '5%', '10%')),
  total           numeric NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factura_items_empresa ON alquiloya.factura_items (empresa_id);
CREATE INDEX IF NOT EXISTS idx_factura_items_factura ON alquiloya.factura_items (factura_id);

-- Columna factura_id en ventas para idempotencia del puente.
ALTER TABLE alquiloya.ventas
  ADD COLUMN IF NOT EXISTS factura_id uuid REFERENCES alquiloya.facturas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_factura ON alquiloya.ventas (factura_id);

-- -----------------------------------------------------------------------------
-- 2. EMPRESA_SIFEN_CONFIG
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.empresa_sifen_config (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                      uuid NOT NULL UNIQUE,
  ambiente                        text NOT NULL DEFAULT 'test'
    CHECK (ambiente IN ('test', 'produccion')),
  ruc                             text NOT NULL DEFAULT '',
  razon_social                    text NOT NULL DEFAULT '',
  timbrado_numero                 text NOT NULL DEFAULT '',
  establecimiento                 text NOT NULL DEFAULT '',
  punto_expedicion                text NOT NULL DEFAULT '',
  csc                             text,
  certificado_path                text,
  certificado_password_encrypted  text,
  certificado_vencimiento         timestamptz,
  direccion_fiscal                text,
  timbrado_fecha_inicio_vigencia  date,
  timbrado_fecha_fin_vigencia     date,
  actividad_economica_codigo      text,
  actividad_economica_descripcion text,
  kude_logo_path                  text,
  kude_color_primario             text,
  kude_color_primario_fill        text,
  sifen_plazo_cancelacion_horas   integer NOT NULL DEFAULT 48
    CHECK (sifen_plazo_cancelacion_horas BETWEEN 1 AND 8760),
  activo                          boolean NOT NULL DEFAULT true,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- Las migrations zentra agregan estas con DO+IF NOT EXISTS — replicamos por seguridad.
ALTER TABLE alquiloya.empresa_sifen_config
  ADD COLUMN IF NOT EXISTS certificado_password_encrypted text,
  ADD COLUMN IF NOT EXISTS direccion_fiscal               text,
  ADD COLUMN IF NOT EXISTS timbrado_fecha_inicio_vigencia date,
  ADD COLUMN IF NOT EXISTS timbrado_fecha_fin_vigencia    date,
  ADD COLUMN IF NOT EXISTS actividad_economica_codigo     text,
  ADD COLUMN IF NOT EXISTS actividad_economica_descripcion text,
  ADD COLUMN IF NOT EXISTS kude_logo_path                 text,
  ADD COLUMN IF NOT EXISTS kude_color_primario            text,
  ADD COLUMN IF NOT EXISTS kude_color_primario_fill       text,
  ADD COLUMN IF NOT EXISTS sifen_plazo_cancelacion_horas  integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'empresa_sifen_config_kude_color_primario_fmt_chk'
      AND conrelid = 'alquiloya.empresa_sifen_config'::regclass
  ) THEN
    ALTER TABLE alquiloya.empresa_sifen_config
      ADD CONSTRAINT empresa_sifen_config_kude_color_primario_fmt_chk
      CHECK (kude_color_primario IS NULL OR kude_color_primario ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'empresa_sifen_config_kude_color_primario_fill_fmt_chk'
      AND conrelid = 'alquiloya.empresa_sifen_config'::regclass
  ) THEN
    ALTER TABLE alquiloya.empresa_sifen_config
      ADD CONSTRAINT empresa_sifen_config_kude_color_primario_fill_fmt_chk
      CHECK (kude_color_primario_fill IS NULL OR kude_color_primario_fill ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

DROP TRIGGER IF EXISTS empresa_sifen_config_set_updated_at ON alquiloya.empresa_sifen_config;
CREATE TRIGGER empresa_sifen_config_set_updated_at
  BEFORE UPDATE ON alquiloya.empresa_sifen_config
  FOR EACH ROW EXECUTE FUNCTION alquiloya.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. FACTURA_ELECTRONICA + EVENTO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.factura_electronica (
  id                                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                           uuid NOT NULL,
  factura_id                           uuid NOT NULL UNIQUE
                                          REFERENCES alquiloya.facturas(id) ON DELETE CASCADE,
  estado_sifen                         text NOT NULL DEFAULT 'borrador',
  cdc                                  text,
  xml_path                             text,
  xml_firmado_path                     text,
  "kuDE_url"                           text,
  qr_data                              text,
  error                                text,
  sifen_d_prot_cons_lote               text,
  sifen_ultima_respuesta_recibe_lote   jsonb,
  sifen_ultima_respuesta_consulta_lote jsonb,
  sifen_aprobado_at                    timestamptz,
  sifen_cancelado_at                   timestamptz,
  sifen_cancelacion_motivo             text,
  sifen_regeneracion_seq               integer NOT NULL DEFAULT 0,
  created_at                           timestamptz NOT NULL DEFAULT now(),
  updated_at                           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factura_electronica_empresa
  ON alquiloya.factura_electronica (empresa_id);
CREATE INDEX IF NOT EXISTS idx_factura_electronica_factura
  ON alquiloya.factura_electronica (factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_electronica_empresa_estado
  ON alquiloya.factura_electronica (empresa_id, estado_sifen);

-- Columnas acumulativas (idempotente) por si la tabla ya existia con otra forma.
ALTER TABLE alquiloya.factura_electronica
  ADD COLUMN IF NOT EXISTS xml_firmado_path                     text,
  ADD COLUMN IF NOT EXISTS "kuDE_url"                           text,
  ADD COLUMN IF NOT EXISTS qr_data                              text,
  ADD COLUMN IF NOT EXISTS sifen_d_prot_cons_lote               text,
  ADD COLUMN IF NOT EXISTS sifen_ultima_respuesta_recibe_lote   jsonb,
  ADD COLUMN IF NOT EXISTS sifen_ultima_respuesta_consulta_lote jsonb,
  ADD COLUMN IF NOT EXISTS sifen_aprobado_at                    timestamptz,
  ADD COLUMN IF NOT EXISTS sifen_cancelado_at                   timestamptz,
  ADD COLUMN IF NOT EXISTS sifen_cancelacion_motivo             text,
  ADD COLUMN IF NOT EXISTS sifen_regeneracion_seq               integer NOT NULL DEFAULT 0;

ALTER TABLE alquiloya.factura_electronica
  DROP CONSTRAINT IF EXISTS factura_electronica_estado_sifen_check;
ALTER TABLE alquiloya.factura_electronica
  ADD CONSTRAINT factura_electronica_estado_sifen_check
  CHECK (estado_sifen IN (
    'borrador','generado','firmado','enviado','aprobado','rechazado','error_envio','cancelado'
  ));

DROP TRIGGER IF EXISTS factura_electronica_set_updated_at ON alquiloya.factura_electronica;
CREATE TRIGGER factura_electronica_set_updated_at
  BEFORE UPDATE ON alquiloya.factura_electronica
  FOR EACH ROW EXECUTE FUNCTION alquiloya.set_updated_at();

CREATE TABLE IF NOT EXISTS alquiloya.factura_electronica_evento (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             uuid NOT NULL,
  factura_electronica_id uuid NOT NULL
                            REFERENCES alquiloya.factura_electronica(id) ON DELETE CASCADE,
  tipo                   text NOT NULL,
  detalle                jsonb,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factura_electronica_evento_empresa
  ON alquiloya.factura_electronica_evento (empresa_id);
CREATE INDEX IF NOT EXISTS idx_factura_electronica_evento_de
  ON alquiloya.factura_electronica_evento (factura_electronica_id);
CREATE INDEX IF NOT EXISTS idx_factura_electronica_evento_empresa_created
  ON alquiloya.factura_electronica_evento (empresa_id, created_at DESC);

ALTER TABLE alquiloya.factura_electronica_evento
  DROP CONSTRAINT IF EXISTS factura_electronica_evento_tipo_check;
ALTER TABLE alquiloya.factura_electronica_evento
  ADD CONSTRAINT factura_electronica_evento_tipo_check
  CHECK (tipo IN ('generacion','envio','respuesta','error','firma','cancelacion'));

-- -----------------------------------------------------------------------------
-- 4. NOTA_CREDITO + ELECTRONICA + EVENTO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.nota_credito (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                    uuid NOT NULL,
  cliente_id                    uuid,
  factura_id                    uuid NOT NULL REFERENCES alquiloya.facturas(id) ON DELETE RESTRICT,
  monto                         numeric NOT NULL CHECK (monto > 0),
  motivo                        text NOT NULL,
  observacion_interna           text,
  estado_erp                    text NOT NULL DEFAULT 'borrador',
  created_by_user_id            uuid,
  created_by_email_snapshot     text,
  created_by_nombre_snapshot    text,
  saldo_previo_snapshot         numeric NOT NULL DEFAULT 0,
  monto_factura_snapshot        numeric NOT NULL DEFAULT 0,
  suma_pagos_snapshot           numeric NOT NULL DEFAULT 0,
  moneda_snapshot               text NOT NULL DEFAULT 'GS',
  factura_electronica_origen_id uuid REFERENCES alquiloya.factura_electronica(id) ON DELETE SET NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nota_credito_estado_erp_check CHECK (estado_erp IN (
    'borrador','pendiente_envio_sifen','aprobada','rechazada','error','anulada_borrador'
  )),
  CONSTRAINT nota_credito_moneda_snapshot_check CHECK (moneda_snapshot IN ('GS','USD')),
  CONSTRAINT nota_credito_motivo_len_check
    CHECK (length(trim(motivo)) >= 5 AND length(motivo) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_nota_credito_empresa         ON alquiloya.nota_credito (empresa_id);
CREATE INDEX IF NOT EXISTS idx_nota_credito_factura         ON alquiloya.nota_credito (factura_id);
CREATE INDEX IF NOT EXISTS idx_nota_credito_empresa_created ON alquiloya.nota_credito (empresa_id, created_at DESC);

-- Una NC activa por factura
DROP INDEX IF EXISTS alquiloya.uq_nota_credito_factura_estado_activo;
CREATE UNIQUE INDEX uq_nota_credito_factura_estado_activo
  ON alquiloya.nota_credito (factura_id)
  WHERE (estado_erp IN ('borrador','pendiente_envio_sifen','aprobada'));

DROP TRIGGER IF EXISTS nota_credito_set_updated_at ON alquiloya.nota_credito;
CREATE TRIGGER nota_credito_set_updated_at
  BEFORE UPDATE ON alquiloya.nota_credito
  FOR EACH ROW EXECUTE FUNCTION alquiloya.set_updated_at();

CREATE TABLE IF NOT EXISTS alquiloya.nota_credito_electronica (
  id                                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                           uuid NOT NULL,
  nota_credito_id                      uuid NOT NULL UNIQUE
                                          REFERENCES alquiloya.nota_credito(id) ON DELETE CASCADE,
  estado_sifen                         text NOT NULL DEFAULT 'sin_envio',
  cdc                                  text,
  cdc_factura_origen                   text,
  xml_path                             text,
  xml_firmado_path                     text,
  kude_url                             text,
  response_json                        jsonb,
  error                                text,
  sifen_d_prot_cons_lote               text,
  sifen_ultima_respuesta_recibe_lote   jsonb,
  sifen_ultima_respuesta_consulta_lote jsonb,
  sifen_aprobado_at                    timestamptz,
  last_response_json                   jsonb,
  last_error                           text,
  created_at                           timestamptz NOT NULL DEFAULT now(),
  updated_at                           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nota_credito_electronica_estado_sifen_check CHECK (estado_sifen IN (
    'sin_envio','borrador','generado','firmado','enviado','aprobado','rechazado','error_envio','cancelado'
  ))
);

-- Acumulativas para parity con zentra fase2
ALTER TABLE alquiloya.nota_credito_electronica
  ADD COLUMN IF NOT EXISTS sifen_d_prot_cons_lote               text,
  ADD COLUMN IF NOT EXISTS sifen_ultima_respuesta_recibe_lote   jsonb,
  ADD COLUMN IF NOT EXISTS sifen_ultima_respuesta_consulta_lote jsonb,
  ADD COLUMN IF NOT EXISTS sifen_aprobado_at                    timestamptz,
  ADD COLUMN IF NOT EXISTS last_response_json                   jsonb,
  ADD COLUMN IF NOT EXISTS last_error                           text;

CREATE INDEX IF NOT EXISTS idx_nota_credito_electronica_empresa
  ON alquiloya.nota_credito_electronica (empresa_id);

DROP TRIGGER IF EXISTS nota_credito_electronica_set_updated_at ON alquiloya.nota_credito_electronica;
CREATE TRIGGER nota_credito_electronica_set_updated_at
  BEFORE UPDATE ON alquiloya.nota_credito_electronica
  FOR EACH ROW EXECUTE FUNCTION alquiloya.set_updated_at();

CREATE TABLE IF NOT EXISTS alquiloya.nota_credito_evento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  nota_credito_id uuid NOT NULL REFERENCES alquiloya.nota_credito(id) ON DELETE CASCADE,
  actor_user_id   uuid,
  tipo_evento     text NOT NULL,
  detalle_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nota_credito_evento_tipo_check CHECK (tipo_evento IN (
    'creacion','validacion','rechazo_negocio','cambio_estado_erp',
    'preparacion_sifen','error','observacion_operativa','anulacion_borrador'
  ))
);

CREATE INDEX IF NOT EXISTS idx_nota_credito_evento_empresa
  ON alquiloya.nota_credito_evento (empresa_id);
CREATE INDEX IF NOT EXISTS idx_nota_credito_evento_nc
  ON alquiloya.nota_credito_evento (nota_credito_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
