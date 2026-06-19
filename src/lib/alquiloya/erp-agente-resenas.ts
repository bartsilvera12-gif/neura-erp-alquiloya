import "server-only";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

const ALQUILOYA_SCHEMA = "alquiloya";
export const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function q(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

export type ErpAgenteResena = {
  id: string;
  agente_id: string;
  agente_nombre: string | null;
  autor_nombre: string;
  rol: string | null;
  stars: number;
  body: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  created_at: string | null;
  revisado_at: string | null;
};

async function tableExists(): Promise<boolean> {
  const pool = getChatPostgresPool();
  if (!pool) return false;
  const { rows } = await queryWithRetry<{ exists: boolean }>(
    pool,
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname=$1 AND c.relname='agente_resenas' AND c.relkind='r'
     ) AS exists`,
    [ALQUILOYA_SCHEMA]
  );
  return rows?.[0]?.exists === true;
}

export async function listErpAgenteResenas(): Promise<ErpAgenteResena[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await tableExists())) return [];
  const { rows } = await queryWithRetry<ErpAgenteResena>(
    pool,
    `SELECT r.id, r.agente_id, a.nombre AS agente_nombre,
            r.autor_nombre, r.rol, r.stars, r.body,
            r.estado, r.motivo_rechazo,
            r.created_at::text AS created_at,
            r.revisado_at::text AS revisado_at
       FROM ${q("agente_resenas")} r
       LEFT JOIN ${q("agentes")} a ON a.empresa_id=r.empresa_id AND a.id=r.agente_id
      WHERE r.empresa_id = $1::uuid
      ORDER BY (r.estado = 'pendiente') DESC, r.created_at DESC NULLS LAST
      LIMIT 500`,
    [ALQUILOYA_EMPRESA_ID]
  );
  return rows ?? [];
}
