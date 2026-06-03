import "server-only";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

/**
 * Server-side helpers para el módulo ERP read-only de Propiedades (AlquiloYa).
 * No filtran por `visible_web/activo` — la vista ERP muestra todas las filas y
 * el operador decide en base a los flags.
 */

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function q(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

// Cache de existencia de columnas opcionales (la app vive hasta que reinicia).
let hasDestacadaHasta: boolean | null = null;
async function destacadaHastaExists(): Promise<boolean> {
  if (hasDestacadaHasta != null) return hasDestacadaHasta;
  const pool = getChatPostgresPool();
  if (!pool) return false;
  try {
    const { rows } = await queryWithRetry<{ ok: boolean }>(
      pool,
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema='alquiloya' AND table_name='propiedades' AND column_name='destacada_hasta'
       ) AS ok`
    );
    hasDestacadaHasta = rows[0]?.ok === true;
  } catch {
    hasDestacadaHasta = false;
  }
  return hasDestacadaHasta;
}

export type ErpPropiedadListRow = {
  id: string;
  codigo: string | null;
  titulo: string | null;
  tipo: string | null;
  operacion: string | null;
  estado: string | null;
  ciudad: string | null;
  barrio: string | null;
  precio: number | null;
  moneda: string | null;
  dormitorios: number | null;
  banos: number | null;
  destacada: boolean | null;
  destacada_hasta: string | null;
  destacada_efectiva: boolean | null;
  visible_web: boolean | null;
  activo: boolean | null;
  created_at: string | null;
  agente_id: string | null;
  agente_nombre: string | null;
  cover_url: string | null;
  fotos_count: number;
  caracteristicas_count: number;
};

export type ErpPropiedadDetail = ErpPropiedadListRow & {
  descripcion: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  cocheras: number | null;
  superficie_m2: number | null;
  terreno_m2: number | null;
  updated_at: string | null;
  agente: {
    id: string;
    nombre: string | null;
    email: string | null;
    telefono: string | null;
    whatsapp: string | null;
    foto_url: string | null;
    cargo: string | null;
    bio: string | null;
  } | null;
  fotos: Array<{
    id: string;
    url: string;
    alt: string | null;
    orden: number | null;
    es_portada: boolean | null;
  }>;
  caracteristicas: Array<{
    id: string;
    nombre: string | null;
    valor: string | null;
    icono: string | null;
    orden: number | null;
  }>;
};

export async function listErpPropiedades(): Promise<ErpPropiedadListRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  const hasDH = await destacadaHastaExists();
  const dhSelect = hasDH
    ? "p.destacada_hasta::text AS destacada_hasta,\n        (p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now())) AS destacada_efectiva,"
    : "NULL::text AS destacada_hasta,\n        p.destacada AS destacada_efectiva,";
  const dhOrder = hasDH
    ? "(p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now()))"
    : "p.destacada";
  const { rows } = await queryWithRetry<ErpPropiedadListRow>(
    pool,
    `
      SELECT
        p.id, p.codigo, p.titulo, p.tipo, p.operacion, p.estado,
        p.ciudad, p.barrio,
        p.precio::float8 AS precio, p.moneda,
        p.dormitorios, p.banos,
        p.destacada,
        ${dhSelect}
        p.visible_web, p.activo,
        p.created_at::text AS created_at,
        p.agente_id,
        a.nombre AS agente_nombre,
        cover.url AS cover_url,
        COALESCE(fcnt.n, 0)::int AS fotos_count,
        COALESCE(ccnt.n, 0)::int AS caracteristicas_count
      FROM ${q("propiedades")} p
      LEFT JOIN ${q("agentes")} a
        ON a.id = p.agente_id AND a.empresa_id = p.empresa_id
      LEFT JOIN LATERAL (
        SELECT pf.url
        FROM ${q("propiedad_fotos")} pf
        WHERE pf.empresa_id = p.empresa_id
          AND pf.propiedad_id = p.id
          AND pf.activo = true
        ORDER BY pf.es_portada DESC, pf.orden ASC, pf.created_at ASC, pf.id ASC
        LIMIT 1
      ) cover ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS n
        FROM ${q("propiedad_fotos")} pf
        WHERE pf.empresa_id = p.empresa_id
          AND pf.propiedad_id = p.id
          AND pf.activo = true
      ) fcnt ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS n
        FROM ${q("propiedad_caracteristicas")} pc
        WHERE pc.empresa_id = p.empresa_id
          AND pc.propiedad_id = p.id
          AND pc.activo = true
      ) ccnt ON true
      WHERE p.empresa_id = $1::uuid
      ORDER BY ${dhOrder} DESC NULLS LAST,
               p.created_at DESC NULLS LAST, p.titulo ASC
    `,
    [ALQUILOYA_EMPRESA_ID]
  );
  return rows ?? [];
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getErpPropiedad(id: string): Promise<ErpPropiedadDetail | null> {
  if (!uuidRe.test(id)) return null;
  const pool = getChatPostgresPool();
  if (!pool) return null;

  const hasDH = await destacadaHastaExists();
  const dhSelect = hasDH
    ? "p.destacada_hasta::text AS destacada_hasta,\n        (p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now())) AS destacada_efectiva,"
    : "NULL::text AS destacada_hasta,\n        p.destacada AS destacada_efectiva,";
  const { rows } = await queryWithRetry<ErpPropiedadDetail>(
    pool,
    `
      SELECT
        p.id, p.codigo, p.titulo, p.descripcion, p.tipo, p.operacion, p.estado,
        p.ciudad, p.barrio, p.direccion,
        p.lat::float8 AS lat, p.lng::float8 AS lng,
        p.precio::float8 AS precio, p.moneda,
        p.dormitorios, p.banos, p.cocheras,
        p.superficie_m2::float8 AS superficie_m2,
        p.terreno_m2::float8 AS terreno_m2,
        p.destacada,
        ${dhSelect}
        p.visible_web, p.activo,
        p.created_at::text AS created_at, p.updated_at::text AS updated_at,
        p.agente_id,
        a.nombre AS agente_nombre,
        cover.url AS cover_url,
        COALESCE(fcnt.n, 0)::int AS fotos_count,
        COALESCE(ccnt.n, 0)::int AS caracteristicas_count,
        CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object(
          'id', a.id, 'nombre', a.nombre, 'email', a.email,
          'telefono', a.telefono, 'whatsapp', a.whatsapp,
          'foto_url', a.foto_url, 'cargo', a.cargo, 'bio', a.bio
        ) END AS agente,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', pf.id, 'url', pf.url, 'alt', pf.alt,
            'orden', pf.orden, 'es_portada', pf.es_portada
          ) ORDER BY pf.es_portada DESC, pf.orden ASC, pf.created_at ASC, pf.id ASC)
          FROM ${q("propiedad_fotos")} pf
          WHERE pf.empresa_id = p.empresa_id
            AND pf.propiedad_id = p.id
            AND pf.activo = true
        ), '[]'::json) AS fotos,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', pc.id, 'nombre', pc.nombre, 'valor', pc.valor,
            'icono', pc.icono, 'orden', pc.orden
          ) ORDER BY pc.orden ASC, pc.nombre ASC, pc.id ASC)
          FROM ${q("propiedad_caracteristicas")} pc
          WHERE pc.empresa_id = p.empresa_id
            AND pc.propiedad_id = p.id
            AND pc.activo = true
        ), '[]'::json) AS caracteristicas
      FROM ${q("propiedades")} p
      LEFT JOIN ${q("agentes")} a
        ON a.id = p.agente_id AND a.empresa_id = p.empresa_id
      LEFT JOIN LATERAL (
        SELECT pf.url
        FROM ${q("propiedad_fotos")} pf
        WHERE pf.empresa_id = p.empresa_id
          AND pf.propiedad_id = p.id
          AND pf.activo = true
        ORDER BY pf.es_portada DESC, pf.orden ASC, pf.created_at ASC, pf.id ASC
        LIMIT 1
      ) cover ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS n
        FROM ${q("propiedad_fotos")} pf
        WHERE pf.empresa_id = p.empresa_id
          AND pf.propiedad_id = p.id
          AND pf.activo = true
      ) fcnt ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS n
        FROM ${q("propiedad_caracteristicas")} pc
        WHERE pc.empresa_id = p.empresa_id
          AND pc.propiedad_id = p.id
          AND pc.activo = true
      ) ccnt ON true
      WHERE p.empresa_id = $1::uuid AND p.id = $2::uuid
      LIMIT 1
    `,
    [ALQUILOYA_EMPRESA_ID, id]
  );
  return rows[0] ?? null;
}
