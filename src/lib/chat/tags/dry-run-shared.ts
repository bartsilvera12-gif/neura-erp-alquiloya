import type { Pool } from "pg";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

/**
 * Etiquetas Automáticas - FASE 2 (dry-run).
 * READ-ONLY: solo SELECT, no escribe en chat_conversations ni en chat_conversation_tag_history.
 * El motor de aplicación efectiva quedará para una fase posterior.
 */

export const TAG_DRY_RUN_DEFAULT_LIMIT = 100;
export const TAG_DRY_RUN_MAX_LIMIT = 500;
export const TAG_DRY_RUN_DEFAULT_DAYS = 7;

export type TagPurchaseCategory =
  | "purchased_once"
  | "purchased_multiple_tickets"
  | "repurchased"
  | "payment_received_incomplete"
  | "data_incomplete"
  | "abandoned"
  | "no_purchase"
  | "unknown";

export type SuggestedTagCode =
  | "compro_boleta"
  | "compro_varias"
  | "recomprador"
  | "no_compro"
  | "comprobante_pendiente"
  | "datos_incompletos"
  | "abandonado"
  | null;

export const CATEGORY_TO_TAG_CODE: Record<TagPurchaseCategory, Exclude<SuggestedTagCode, null>> = {
  purchased_once: "compro_boleta",
  purchased_multiple_tickets: "compro_varias",
  repurchased: "recomprador",
  payment_received_incomplete: "comprobante_pendiente",
  data_incomplete: "datos_incompletos",
  abandoned: "abandonado",
  no_purchase: "no_compro",
  unknown: "no_compro",
};

export type TagDryRunPurchaseFilter =
  | "any"
  | "purchased_any"
  | "no_purchase"
  | "payment_pending"
  | "abandoned"
  | "data_incomplete";

export interface TagDryRunInput {
  empresaId: string;
  schema: string;
  daysWithoutActivity: number;
  limit: number;
  channelId?: string | null;
  purchaseCondition?: TagDryRunPurchaseFilter;
  ruleId?: string | null;
  includeReasons?: boolean;
  excludeHumanTakenOver?: boolean;
  excludeActiveBotSession?: boolean;
  excludeManualClosure?: boolean;
}

export interface TagDryRunSampleItem {
  conversation_id: string;
  contact_id: string | null;
  phone_masked: string | null;
  last_message_at: string | null;
  days_without_activity: number | null;
  category: TagPurchaseCategory;
  suggested_tag: Exclude<SuggestedTagCode, null>;
  rule_id: string | null;
  reason?: string;
}

export interface TagDryRunExcludedItem {
  conversation_id: string;
  excluded_reason: string;
}

export interface TagDryRunResult {
  dry_run: true;
  wrote_changes: false;
  rule_id: string | null;
  filters: {
    days_without_activity: number;
    limit: number;
    channel_id: string | null;
    purchase_condition: TagDryRunPurchaseFilter;
    exclude_human_taken_over: boolean;
    exclude_active_bot_session: boolean;
    exclude_manual_closure: boolean;
  };
  scanned: number;
  total_candidates: number;
  by_category: Record<string, number>;
  by_suggested_tag: Record<string, number>;
  sample: TagDryRunSampleItem[];
  excluded: TagDryRunExcludedItem[];
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  if (digits.length <= 4) return digits;
  const tail = digits.slice(-4);
  return `***${tail}`;
}

function categoryMatchesFilter(
  category: TagPurchaseCategory,
  filter: TagDryRunPurchaseFilter
): boolean {
  switch (filter) {
    case "any":
      return true;
    case "purchased_any":
      return (
        category === "purchased_once" ||
        category === "purchased_multiple_tickets" ||
        category === "repurchased"
      );
    case "no_purchase":
      return category === "no_purchase" || category === "unknown";
    case "payment_pending":
      return category === "payment_received_incomplete";
    case "abandoned":
      return category === "abandoned";
    case "data_incomplete":
      return category === "data_incomplete";
    default:
      return true;
  }
}

export interface TagRuleRow {
  id: string;
  empresa_id: string;
  channel_id: string | null;
  tag_id: string;
  days_without_activity: number;
  purchase_condition: string;
  exclude_human_taken_over: boolean;
  exclude_active_bot_session: boolean;
  exclude_manual_closure: boolean;
}

export async function loadTagRule(
  pool: Pool,
  schema: string,
  empresaId: string,
  ruleId: string
): Promise<TagRuleRow | null> {
  const sch = assertAllowedChatDataSchema(schema);
  const r = await pool.query(
    `SELECT id::text, empresa_id::text, channel_id::text, tag_id::text,
            days_without_activity, purchase_condition,
            exclude_human_taken_over, exclude_active_bot_session, exclude_manual_closure
       FROM "${sch}".chat_conversation_tag_rules
       WHERE id = $1 AND empresa_id = $2
       LIMIT 1`,
    [ruleId, empresaId]
  );
  if (!r.rows.length) return null;
  return r.rows[0] as TagRuleRow;
}

export async function runTagDryRun(pool: Pool, input: TagDryRunInput): Promise<TagDryRunResult> {
  const sch = assertAllowedChatDataSchema(input.schema);
  const days = Math.max(1, Math.floor(input.daysWithoutActivity || TAG_DRY_RUN_DEFAULT_DAYS));
  const limit = Math.min(
    TAG_DRY_RUN_MAX_LIMIT,
    Math.max(1, Math.floor(input.limit || TAG_DRY_RUN_DEFAULT_LIMIT))
  );
  const channelId = input.channelId?.trim() || null;
  const purchaseFilter: TagDryRunPurchaseFilter = (input.purchaseCondition ?? "any") as TagDryRunPurchaseFilter;
  const excludeHuman = input.excludeHumanTakenOver !== false;
  const excludeActiveBot = input.excludeActiveBotSession !== false;
  const excludeManualClosure = input.excludeManualClosure !== false;
  const includeReasons = input.includeReasons === true;

  // SELECT candidatos READ-ONLY.
  // Filtros base:
  //  - status IN ('open','pending')
  //  - hidden_by_tag = false
  //  - current_tag_id IS NULL (todavía sin etiqueta)
  //  - last_message_at < now() - interval (days dias)
  //  - exclude_human_taken_over -> human_taken_over IS NOT TRUE
  //  - exclude_active_bot_session -> active_flow_session_id IS NULL
  //  - exclude_manual_closure -> closed_by_usuario_id IS NULL (no cerradas manualmente)
  const params: unknown[] = [input.empresaId, days];
  let whereExtra = "";
  if (channelId) {
    params.push(channelId);
    whereExtra += ` AND c.channel_id = $${params.length}`;
  }
  if (excludeHuman) {
    whereExtra += ` AND c.human_taken_over IS NOT TRUE`;
  }
  if (excludeActiveBot) {
    whereExtra += ` AND c.active_flow_session_id IS NULL`;
  }
  if (excludeManualClosure) {
    whereExtra += ` AND c.closed_by_usuario_id IS NULL`;
  }
  params.push(limit);

  const sql = `
    SELECT
      c.id::text AS conversation_id,
      c.contact_id::text AS contact_id,
      c.last_message_at,
      c.channel_id::text AS channel_id,
      ct.phone_number,
      EXTRACT(EPOCH FROM (now() - c.last_message_at)) / 86400.0 AS days_idle,
      "${sch}".chat_tag_purchase_category(c.id) AS category
    FROM "${sch}".chat_conversations c
    LEFT JOIN "${sch}".chat_contacts ct ON ct.id = c.contact_id
    WHERE c.empresa_id = $1
      AND c.status IN ('open','pending')
      AND c.hidden_by_tag = false
      AND c.current_tag_id IS NULL
      AND c.last_message_at < now() - ($2::int * interval '1 day')
      ${whereExtra}
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT $${params.length}
  `;

  const r = await pool.query(sql, params);

  const sample: TagDryRunSampleItem[] = [];
  const excluded: TagDryRunExcludedItem[] = [];
  const byCategory: Record<string, number> = {};
  const byTag: Record<string, number> = {};

  for (const row of r.rows as Array<{
    conversation_id: string;
    contact_id: string | null;
    last_message_at: Date | string | null;
    channel_id: string | null;
    phone_number: string | null;
    days_idle: string | number | null;
    category: string | null;
  }>) {
    const rawCategory = (row.category ?? "unknown") as string;
    const category: TagPurchaseCategory =
      ([
        "purchased_once",
        "purchased_multiple_tickets",
        "repurchased",
        "payment_received_incomplete",
        "data_incomplete",
        "abandoned",
        "no_purchase",
        "unknown",
      ].includes(rawCategory)
        ? (rawCategory as TagPurchaseCategory)
        : "unknown");

    if (!categoryMatchesFilter(category, purchaseFilter)) {
      excluded.push({
        conversation_id: row.conversation_id,
        excluded_reason: `category_filtered:${category}`,
      });
      continue;
    }

    const suggested = CATEGORY_TO_TAG_CODE[category];
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    byTag[suggested] = (byTag[suggested] ?? 0) + 1;

    const lm =
      row.last_message_at instanceof Date
        ? row.last_message_at.toISOString()
        : row.last_message_at != null
          ? String(row.last_message_at)
          : null;

    const daysIdle =
      row.days_idle == null
        ? null
        : Math.floor(typeof row.days_idle === "string" ? parseFloat(row.days_idle) : row.days_idle);

    const item: TagDryRunSampleItem = {
      conversation_id: row.conversation_id,
      contact_id: row.contact_id,
      phone_masked: maskPhone(row.phone_number),
      last_message_at: lm,
      days_without_activity: daysIdle,
      category,
      suggested_tag: suggested,
      rule_id: input.ruleId ?? null,
    };
    if (includeReasons) {
      item.reason = `category=${category}; days_idle>=${days}`;
    }
    sample.push(item);
  }

  return {
    dry_run: true,
    wrote_changes: false,
    rule_id: input.ruleId ?? null,
    filters: {
      days_without_activity: days,
      limit,
      channel_id: channelId,
      purchase_condition: purchaseFilter,
      exclude_human_taken_over: excludeHuman,
      exclude_active_bot_session: excludeActiveBot,
      exclude_manual_closure: excludeManualClosure,
    },
    scanned: r.rows.length,
    total_candidates: sample.length,
    by_category: byCategory,
    by_suggested_tag: byTag,
    sample,
    excluded,
  };
}
