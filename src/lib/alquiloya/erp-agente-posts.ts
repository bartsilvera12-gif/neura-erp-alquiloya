import "server-only";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

const ALQUILOYA_SCHEMA = "alquiloya";
export const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function q(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

export type AgentePostRow = {
  id: string;
  agente_id: string;
  agente_nombre: string | null;
  slug: string;
  titulo: string;
  resumen: string | null;
  contenido: string | null;
  cover_url: string | null;
  publicado: boolean;
  destacado: boolean;
  orden: number;
  publicado_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

async function tableExists(): Promise<boolean> {
  const pool = getChatPostgresPool();
  if (!pool) return false;
  const { rows } = await queryWithRetry<{ exists: boolean }>(
    pool,
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = 'agente_posts' AND c.relkind = 'r'
     ) AS exists`,
    [ALQUILOYA_SCHEMA]
  );
  return rows?.[0]?.exists === true;
}

export async function listErpAgentePosts(): Promise<AgentePostRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await tableExists())) return [];
  const { rows } = await queryWithRetry<AgentePostRow>(
    pool,
    `SELECT p.id, p.agente_id, a.nombre AS agente_nombre,
            p.slug, p.titulo, p.resumen, p.contenido, p.cover_url,
            p.publicado, p.destacado, p.orden,
            p.publicado_at::text AS publicado_at,
            p.created_at::text AS created_at,
            p.updated_at::text AS updated_at
       FROM ${q("agente_posts")} p
       LEFT JOIN ${q("agentes")} a
         ON a.id = p.agente_id AND a.empresa_id = p.empresa_id
      WHERE p.empresa_id = $1::uuid
      ORDER BY p.updated_at DESC NULLS LAST, p.titulo ASC`,
    [ALQUILOYA_EMPRESA_ID]
  );
  return rows ?? [];
}
