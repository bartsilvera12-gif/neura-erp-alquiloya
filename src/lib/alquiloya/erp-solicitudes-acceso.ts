import "server-only";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

const ALQUILOYA_SCHEMA = "alquiloya";
export const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function q(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

export type SolicitudAccesoRow = {
  id: string;
  tipo: "agente" | "propietario";
  sub_tipo: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  ciudad: string | null;
  mensaje: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  resultado_id: string | null;
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
       WHERE n.nspname = $1 AND c.relname = 'solicitudes_acceso' AND c.relkind = 'r'
     ) AS exists`,
    [ALQUILOYA_SCHEMA]
  );
  return rows?.[0]?.exists === true;
}

export async function listErpSolicitudesAcceso(): Promise<SolicitudAccesoRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await tableExists())) return [];
  const { rows } = await queryWithRetry<SolicitudAccesoRow>(
    pool,
    `SELECT id, tipo, sub_tipo, nombre, email, telefono, empresa, ciudad,
            mensaje, estado, motivo_rechazo, resultado_id,
            created_at::text AS created_at,
            revisado_at::text AS revisado_at
       FROM ${q("solicitudes_acceso")}
      WHERE empresa_id = $1::uuid
      ORDER BY (estado = 'pendiente') DESC, created_at DESC NULLS LAST
      LIMIT 500`,
    [ALQUILOYA_EMPRESA_ID]
  );
  return rows ?? [];
}
