import "server-only";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

/**
 * Server-side helpers para el módulo ERP "Agentes inmobiliarios" (AlquiloYa).
 * Dos pestañas:
 *   - Agentes inmobiliarios → alquiloya.agentes (cuentas externas verificadas)
 *   - Propietarios          → alquiloya.propietarios (creada en Fase 10A)
 *
 * Tolerante a `alquiloya.propietarios` inexistente: si la migración aún no
 * corrió, el listado devuelve []. NO crea la tabla desde acá (se crea vía
 * supabase/migrations/20260616120000_alquiloya_propietarios.sql).
 */

const ALQUILOYA_SCHEMA = "alquiloya";
export const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function q(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

// ---------------------------------------------------------------------------
// Agentes inmobiliarios (alquiloya.agentes)
// ---------------------------------------------------------------------------

export type PlanEstado =
  | "sin_plan"
  | "gratis"
  | "activo"
  | "por_vencer"
  | "vencido";

export type ErpAgenteInmobiliarioRow = {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  cargo: string | null;
  foto_url: string | null;
  activo: boolean | null;
  orden: number | null;
  propiedades_count: number;
  plan_publicacion_id: string | null;
  plan_nombre: string | null;
  plan_tier: string | null;
  plan_billing: string | null;
  plan_vencimiento_at: string | null;
  plan_estado: PlanEstado;
};

export async function listErpAgentesInmobiliarios(): Promise<ErpAgenteInmobiliarioRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  const { rows } = await queryWithRetry<ErpAgenteInmobiliarioRow>(
    pool,
    `
      SELECT
        a.id, a.nombre, a.email, a.telefono, a.whatsapp,
        a.cargo, a.foto_url, a.activo, a.orden,
        COALESCE(pc.n, 0)::int AS propiedades_count,
        a.plan_publicacion_id,
        pp.nombre AS plan_nombre,
        pp.tier   AS plan_tier,
        pp.billing AS plan_billing,
        a.plan_vencimiento_at::text AS plan_vencimiento_at,
        CASE
          WHEN a.plan_publicacion_id IS NULL THEN 'sin_plan'
          WHEN pp.billing = 'gratis' OR lower(pp.tier) LIKE 'gratuito%' THEN 'gratis'
          WHEN a.plan_vencimiento_at IS NOT NULL AND a.plan_vencimiento_at < now() THEN 'vencido'
          WHEN a.plan_vencimiento_at IS NOT NULL AND a.plan_vencimiento_at < now() + interval '7 days' THEN 'por_vencer'
          ELSE 'activo'
        END AS plan_estado
      FROM ${q("agentes")} a
      LEFT JOIN ${q("planes_publicacion")} pp ON pp.id = a.plan_publicacion_id
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS n
        FROM ${q("propiedades")} p
        WHERE p.empresa_id = a.empresa_id
          AND p.agente_id = a.id
      ) pc ON true
      WHERE a.empresa_id = $1::uuid
      ORDER BY a.orden ASC NULLS LAST, a.nombre ASC
    `,
    [ALQUILOYA_EMPRESA_ID]
  );
  return rows ?? [];
}

// ---------------------------------------------------------------------------
// Propietarios (alquiloya.propietarios)
// ---------------------------------------------------------------------------

export type ErpPropietarioRow = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  documento: string | null;
  tipo_persona: string | null;
  estado: string | null;
  activo: boolean;
  usuario_id: string | null;
  plan_publicacion_id: string | null;
  plan_nombre: string | null;
  plan_tier: string | null;
  plan_billing: string | null;
  plan_vencimiento_at: string | null;
  plan_estado: PlanEstado;
  created_at: string | null;
};

async function propietariosTableExists(): Promise<boolean> {
  const pool = getChatPostgresPool();
  if (!pool) return false;
  const { rows } = await queryWithRetry<{ exists: boolean }>(
    pool,
    `
      SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = 'propietarios' AND c.relkind = 'r'
      ) AS exists
    `,
    [ALQUILOYA_SCHEMA]
  );
  return rows?.[0]?.exists === true;
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Detalle de agente y acceso al portal (alquiloya.usuarios.agente_id si existe)
// ---------------------------------------------------------------------------

export type ErpAgenteAccesoUsuario = {
  id: string;
  email: string | null;
  rol: string | null;
  activo: boolean | null;
};

export type ErpAgenteInmobiliarioDetail = ErpAgenteInmobiliarioRow & {
  bio: string | null;
  verificado: boolean | null;
  nivel: string | null;
  idiomas: string | null;
  tiempo_respuesta: string | null;
  tasa_respuesta: string | null;
  acceso: ErpAgenteAccesoUsuario | null;
};

async function tableHasColumn(schema: string, table: string, column: string): Promise<boolean> {
  const pool = getChatPostgresPool();
  if (!pool) return false;
  const { rows } = await queryWithRetry<{ exists: boolean }>(
    pool,
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema=$1 AND table_name=$2 AND column_name=$3
     ) AS exists`,
    [schema, table, column]
  );
  return rows?.[0]?.exists === true;
}

export type ErpAgenteCaptacion = {
  id: string;
  propietario_nombre: string | null;
  propietario_email: string | null;
  propietario_telefono: string | null;
  propiedad_titulo: string | null;
  tipo_propiedad: string | null;
  ciudad: string | null;
  barrio: string | null;
  etapa: string;
  estado: string;
  created_at: string | null;
};

export async function listErpAgenteCaptaciones(agenteId: string): Promise<ErpAgenteCaptacion[]> {
  if (!uuidRe.test(agenteId)) return [];
  const pool = getChatPostgresPool();
  if (!pool) return [];
  try {
    if (!(await tableHasColumn("alquiloya", "agente_captaciones", "id"))) return [];
    const { rows } = await queryWithRetry<ErpAgenteCaptacion>(
      pool,
      `SELECT id, propietario_nombre, propietario_email, propietario_telefono,
              propiedad_titulo, tipo_propiedad, ciudad, barrio,
              etapa, estado, created_at::text AS created_at
         FROM ${q("agente_captaciones")}
        WHERE empresa_id = $1::uuid AND agente_id = $2::uuid
        ORDER BY created_at DESC
        LIMIT 50`,
      [ALQUILOYA_EMPRESA_ID, agenteId]
    );
    return rows ?? [];
  } catch (e) {
    console.warn("[listErpAgenteCaptaciones]", (e as Error).message);
    return [];
  }
}

export async function getErpAgenteInmobiliario(
  id: string
): Promise<ErpAgenteInmobiliarioDetail | null> {
  if (!uuidRe.test(id)) return null;
  const pool = getChatPostgresPool();
  if (!pool) return null;

  const { rows } = await queryWithRetry<
    ErpAgenteInmobiliarioRow & {
      bio: string | null;
      verificado: boolean | null;
      nivel: string | null;
      idiomas: string | null;
      tiempo_respuesta: string | null;
      tasa_respuesta: string | null;
    }
  >(
    pool,
    `
      SELECT
        a.id, a.nombre, a.email, a.telefono, a.whatsapp,
        a.cargo, a.foto_url, a.activo, a.orden, a.bio,
        a.verificado, a.nivel, a.idiomas, a.tiempo_respuesta, a.tasa_respuesta,
        COALESCE(pc.n, 0)::int AS propiedades_count
      FROM ${q("agentes")} a
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS n
        FROM ${q("propiedades")} p
        WHERE p.empresa_id = a.empresa_id AND p.agente_id = a.id
      ) pc ON true
      WHERE a.empresa_id = $1::uuid AND a.id = $2::uuid
      LIMIT 1
    `,
    [ALQUILOYA_EMPRESA_ID, id]
  );
  if (!rows || rows.length === 0) return null;
  const base = rows[0];

  let acceso: ErpAgenteAccesoUsuario | null = null;
  try {
    if (await tableHasColumn("alquiloya", "usuarios", "agente_id")) {
      const { rows: ur } = await queryWithRetry<ErpAgenteAccesoUsuario>(
        pool,
        `
          SELECT id, email, rol, activo
          FROM ${q("usuarios")}
          WHERE empresa_id = $1::uuid AND agente_id = $2::uuid
          ORDER BY created_at DESC NULLS LAST
          LIMIT 1
        `,
        [ALQUILOYA_EMPRESA_ID, id]
      );
      if (ur && ur.length > 0) acceso = ur[0];
    }
  } catch (e) {
    console.warn("[erp-agentes-inmobiliarios] acceso agente:", (e as Error).message);
  }

  return { ...base, acceso };
}

// ---------------------------------------------------------------------------
// Detalle de propietario y acceso al portal
// ---------------------------------------------------------------------------

export type ErpPropietarioDetail = ErpPropietarioRow & {
  observaciones: string | null;
  acceso: ErpAgenteAccesoUsuario | null;
};

export async function getErpPropietario(id: string): Promise<ErpPropietarioDetail | null> {
  if (!uuidRe.test(id)) return null;
  const pool = getChatPostgresPool();
  if (!pool) return null;
  if (!(await propietariosTableExists())) return null;

  const { rows } = await queryWithRetry<ErpPropietarioRow & { observaciones: string | null }>(
    pool,
    `
      SELECT pr.id, pr.nombre, pr.email, pr.telefono, pr.documento, pr.tipo_persona,
             pr.estado, pr.activo, pr.usuario_id, pr.plan_publicacion_id,
             pp.nombre AS plan_nombre,
             pp.tier   AS plan_tier,
             pp.billing AS plan_billing,
             pr.plan_vencimiento_at::text AS plan_vencimiento_at,
             CASE
               WHEN pr.plan_publicacion_id IS NULL THEN 'sin_plan'
               WHEN pp.billing = 'gratis' OR lower(pp.tier) LIKE 'gratuito%' THEN 'gratis'
               WHEN pr.plan_vencimiento_at IS NOT NULL AND pr.plan_vencimiento_at < now() THEN 'vencido'
               WHEN pr.plan_vencimiento_at IS NOT NULL AND pr.plan_vencimiento_at < now() + interval '7 days' THEN 'por_vencer'
               ELSE 'activo'
             END AS plan_estado,
             pr.observaciones,
             pr.created_at::text AS created_at
      FROM ${q("propietarios")} pr
      LEFT JOIN ${q("planes_publicacion")} pp ON pp.id = pr.plan_publicacion_id
      WHERE pr.empresa_id = $1::uuid AND pr.id = $2::uuid
      LIMIT 1
    `,
    [ALQUILOYA_EMPRESA_ID, id]
  );
  if (!rows || rows.length === 0) return null;
  const base = rows[0];

  let acceso: ErpAgenteAccesoUsuario | null = null;
  try {
    if (base.usuario_id && uuidRe.test(base.usuario_id)) {
      const hasUsuarios = await tableHasColumn("alquiloya", "usuarios", "id");
      if (hasUsuarios) {
        const { rows: ur } = await queryWithRetry<ErpAgenteAccesoUsuario>(
          pool,
          `SELECT id, email, rol, activo
             FROM ${q("usuarios")}
             WHERE empresa_id = $1::uuid AND id = $2::uuid
             LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, base.usuario_id]
        );
        if (ur && ur.length > 0) acceso = ur[0];
      }
    }
  } catch (e) {
    console.warn("[erp-agentes-inmobiliarios] acceso propietario:", (e as Error).message);
  }

  return { ...base, acceso };
}

export async function listErpPropietarios(): Promise<ErpPropietarioRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await propietariosTableExists())) return [];

  const { rows } = await queryWithRetry<ErpPropietarioRow>(
    pool,
    `
      SELECT
        pr.id, pr.nombre, pr.email, pr.telefono, pr.documento, pr.tipo_persona,
        pr.estado, pr.activo, pr.usuario_id, pr.plan_publicacion_id,
        pp.nombre AS plan_nombre,
        pp.tier   AS plan_tier,
        pp.billing AS plan_billing,
        pr.plan_vencimiento_at::text AS plan_vencimiento_at,
        CASE
          WHEN pr.plan_publicacion_id IS NULL THEN 'sin_plan'
          WHEN pp.billing = 'gratis' OR lower(pp.tier) LIKE 'gratuito%' THEN 'gratis'
          WHEN pr.plan_vencimiento_at IS NOT NULL AND pr.plan_vencimiento_at < now() THEN 'vencido'
          WHEN pr.plan_vencimiento_at IS NOT NULL AND pr.plan_vencimiento_at < now() + interval '7 days' THEN 'por_vencer'
          ELSE 'activo'
        END AS plan_estado,
        pr.created_at::text AS created_at
      FROM ${q("propietarios")} pr
      LEFT JOIN ${q("planes_publicacion")} pp ON pp.id = pr.plan_publicacion_id
      WHERE pr.empresa_id = $1::uuid
      ORDER BY pr.created_at DESC NULLS LAST, lower(pr.nombre) ASC
    `,
    [ALQUILOYA_EMPRESA_ID]
  );
  return rows ?? [];
}
