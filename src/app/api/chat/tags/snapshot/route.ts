import { NextRequest, NextResponse } from "next/server";
import { getAuthWithRol } from "@/lib/middleware/auth";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

/**
 * Etiquetas Automáticas - FASE 4A.
 * READ-ONLY: lista filas del snapshot shadow (chat_conversation_tag_history)
 * con filtros y paginación. NO escribe en ninguna tabla.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function parseIntParam(value: string | null, fallback: number, max?: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  if (max && n > max) return max;
  return n;
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function maskPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D+/g, "");
  if (digits.length <= 4) return digits;
  return `***${digits.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthWithRol(request);
    if (!auth?.empresa_id) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const pool = getChatPostgresPool();
    if (!pool) {
      return NextResponse.json({ ok: false, error: "Pool no disponible" }, { status: 503 });
    }
    const schema = assertAllowedChatDataSchema(await fetchDataSchemaForEmpresaId(auth.empresa_id));

    const url = new URL(request.url);
    const runKey = (url.searchParams.get("run_key") || "").trim();
    const tagCode = (url.searchParams.get("tag_code") || "").trim();
    const phoneRaw = (url.searchParams.get("phone") || "").replace(/\D+/g, "");
    const dateFromIso = parseDate(url.searchParams.get("date_from"));
    const dateToIso = parseDate(url.searchParams.get("date_to"));
    const currentNode = (url.searchParams.get("current_node_code") || "").trim();
    const limit = parseIntParam(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(0, parseIntParam(url.searchParams.get("offset"), 0, 1_000_000));
    const action = (url.searchParams.get("action") || "dry_run").trim();

    const params: unknown[] = [auth.empresa_id, action];
    const where: string[] = [
      `h.empresa_id = $1`,
      `h.action = $2`,
    ];
    if (runKey) {
      params.push(runKey);
      where.push(`h.metadata->>'run_key' = $${params.length}`);
    }
    if (tagCode) {
      params.push(tagCode);
      where.push(`t.code = $${params.length}`);
    }
    if (phoneRaw && phoneRaw.length >= 3) {
      params.push(`%${phoneRaw}%`);
      where.push(`ct.phone_number LIKE $${params.length}`);
    }
    if (dateFromIso) {
      params.push(dateFromIso);
      where.push(`h.created_at >= $${params.length}::timestamptz`);
    }
    if (dateToIso) {
      params.push(dateToIso);
      where.push(`h.created_at <= $${params.length}::timestamptz`);
    }
    if (currentNode) {
      params.push(currentNode);
      where.push(`h.metadata->>'current_node_code' = $${params.length}`);
    }

    // Total
    const totalSql = `
      SELECT count(*)::int AS n
        FROM "${schema}".chat_conversation_tag_history h
        LEFT JOIN "${schema}".chat_conversation_tags t ON t.id = h.new_tag_id
        LEFT JOIN "${schema}".chat_contacts ct ON ct.id = h.contact_id
       WHERE ${where.join(" AND ")}
    `;
    const totalRes = await pool.query(totalSql, params);
    const total = totalRes.rows[0]?.n ?? 0;

    // by_tag aggregation
    const byTagSql = `
      SELECT COALESCE(t.code, 'sin_tag') AS tag_code,
             COALESCE(t.label, '') AS tag_label,
             count(*)::int AS n
        FROM "${schema}".chat_conversation_tag_history h
        LEFT JOIN "${schema}".chat_conversation_tags t ON t.id = h.new_tag_id
        LEFT JOIN "${schema}".chat_contacts ct ON ct.id = h.contact_id
       WHERE ${where.join(" AND ")}
       GROUP BY t.code, t.label
       ORDER BY n DESC
    `;
    const byTagRes = await pool.query(byTagSql, params);

    // Page
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;
    const listSql = `
      SELECT h.id::text AS history_id,
             h.conversation_id::text AS conversation_id,
             h.contact_id::text AS contact_id,
             COALESCE(t.code, '') AS tag_code,
             COALESCE(t.label, '') AS tag_label,
             ct.phone_number,
             ct.name AS contact_name,
             c.last_message_at,
             c.flow_current_node,
             h.metadata,
             h.created_at
        FROM "${schema}".chat_conversation_tag_history h
        LEFT JOIN "${schema}".chat_conversation_tags t ON t.id = h.new_tag_id
        LEFT JOIN "${schema}".chat_contacts ct ON ct.id = h.contact_id
        LEFT JOIN "${schema}".chat_conversations c ON c.id = h.conversation_id
       WHERE ${where.join(" AND ")}
       ORDER BY h.created_at DESC, h.id DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;
    const listRes = await pool.query(listSql, params);

    const rows = listRes.rows.map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        history_id: r.history_id,
        conversation_id: r.conversation_id,
        contact_id: r.contact_id,
        tag_code: r.tag_code,
        tag_label: r.tag_label,
        phone_masked: maskPhone(r.phone_number),
        contact_name: r.contact_name || null,
        last_message_at: r.last_message_at ? new Date(r.last_message_at).toISOString() : null,
        current_node_code: (meta.current_node_code as string) ?? r.flow_current_node ?? null,
        days_idle: typeof meta.days_idle === "number" ? meta.days_idle : null,
        purchase_condition: (meta.purchase_condition as string) ?? null,
        category: (meta.category as string) ?? null,
        run_key: (meta.run_key as string) ?? null,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      };
    });

    return NextResponse.json({
      ok: true,
      dry_run_only: action === "dry_run",
      wrote_changes: false,
      filters: {
        run_key: runKey || null,
        tag_code: tagCode || null,
        phone: phoneRaw || null,
        date_from: dateFromIso,
        date_to: dateToIso,
        current_node_code: currentNode || null,
        action,
      },
      pagination: { limit, offset, total },
      by_tag: byTagRes.rows,
      rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("[api/chat/tags/snapshot]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
