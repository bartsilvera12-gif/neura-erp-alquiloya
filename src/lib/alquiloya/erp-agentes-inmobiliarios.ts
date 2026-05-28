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
        COALESCE(pc.n, 0)::int AS propiedades_count
      FROM ${q("agentes")} a
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

export async function listErpPropietarios(): Promise<ErpPropietarioRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await propietariosTableExists())) return [];

  const { rows } = await queryWithRetry<ErpPropietarioRow>(
    pool,
    `
      SELECT
        id, nombre, email, telefono, documento, tipo_persona,
        estado, activo, usuario_id, plan_publicacion_id,
        created_at::text AS created_at
      FROM ${q("propietarios")}
      WHERE empresa_id = $1::uuid
      ORDER BY created_at DESC NULLS LAST, lower(nombre) ASC
    `,
    [ALQUILOYA_EMPRESA_ID]
  );
  return rows ?? [];
}
