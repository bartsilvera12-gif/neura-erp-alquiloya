import type { Pool } from "pg";
import { quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";

export async function pgFetchOperatorRole(
  pool: Pool,
  schema: string,
  empresaId: string,
  usuarioId: string
): Promise<string | null> {
  const qt = quoteSchemaTable(schema, "chat_empresa_operator_roles");
  const q = `
    SELECT role FROM ${qt}
    WHERE empresa_id = $1::uuid AND usuario_id = $2::uuid
    LIMIT 1
  `;
  try {
    const r = await pool.query(q, [empresaId, usuarioId]);
    const v = r.rows?.[0]?.role;
    return v != null && typeof v === "string" ? v.trim() : null;
  } catch {
    return null;
  }
}

export async function pgFetchQueueIdsForSupervisorUsuario(
  pool: Pool,
  schema: string,
  empresaId: string,
  supervisorUsuarioId: string
): Promise<string[]> {
  const qt = quoteSchemaTable(schema, "chat_queue_supervisors");
  try {
    const q = `
      SELECT queue_id::text AS qid FROM ${qt}
      WHERE empresa_id = $1::uuid AND usuario_id = $2::uuid
    `;
    const r = await pool.query(q, [empresaId, supervisorUsuarioId]);
    return [
      ...new Set(
        (r.rows ?? []).map((row: { qid?: string }) => String(row.qid ?? "").trim()).filter(Boolean)
      ),
    ];
  } catch {
    return [];
  }
}

export async function pgFetchAgentsForSupervisorUsuarioIds(
  pool: Pool,
  schema: string,
  empresaId: string,
  supervisorUsuarioId: string
): Promise<string[]> {
  const qt = quoteSchemaTable(schema, "chat_supervisor_agents");
  try {
    const q = `
      SELECT agent_usuario_id::text AS aid FROM ${qt}
      WHERE empresa_id = $1::uuid AND supervisor_usuario_id = $2::uuid
    `;
    const r = await pool.query(q, [empresaId, supervisorUsuarioId]);
    return [
      ...new Set(
        (r.rows ?? []).map((row: { aid?: string }) => String(row.aid ?? "").trim()).filter(Boolean)
      ),
    ];
  } catch {
    return [];
  }
}

export async function pgUsuarioTieneChatAgentsRow(
  pool: Pool,
  schema: string,
  empresaId: string,
  usuarioId: string
): Promise<boolean> {
  const qt = quoteSchemaTable(schema, "chat_agents");
  try {
    const q = `
      SELECT EXISTS (
        SELECT 1 FROM ${qt}
        WHERE empresa_id = $1::uuid AND usuario_id = $2::uuid
        LIMIT 1
      ) AS ok
    `;
    const r = await pool.query(q, [empresaId, usuarioId]);
    return Boolean(r.rows?.[0]?.ok);
  } catch {
    return false;
  }
}
