"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { getChatServiceClientForEmpresa } from "@/lib/supabase/chat-service-role-empresa";
import { asuncionDayBoundsUtc, asuncionMonthBoundsUtc } from "@/lib/sorteos/kpis-time-bounds";
import type { Pool } from "pg";
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

/**
 * KPIs de ventas de sorteos (página principal, solo lectura).
 *
 * Columnas (ver `20250326000003_modulo_sorteos.sql` y migraciones posteriores):
 * - `sorteo_entradas`: empresa_id, sorteo_id, cantidad_boletos, monto_total, estado_pago, created_at
 * - `sorteo_cupones`: entrada_id, empresa_id, sorteo_id (1 fila por número de cupón)
 *
 * Boletos: COUNT de `sorteo_cupones` unido a `sorteo_entradas` creadas en la ventana (misma lógica que
 * "un boleto = un cupón"). Montos: SUM(monto_total) en `sorteo_entradas` en la ventana.
 * Excluye `estado_pago = 'rechazado'`. Sin columna de anulación en entradas: no se filtra otra.
 * Calendario: America/Asuncion (ver `kpis-time-bounds.ts`).
 */
export type SorteosVentasKpis = {
  boletosHoy: number;
  boletosMes: number;
  montoHoy: number;
  montoMes: number;
};

const LOG_ERR = "[sorteos][dashboard-summary][error]";

function logDashboardError(empresaId: string, schema: string, err: unknown) {
  const message =
    err instanceof Error
      ? err.message.slice(0, 200)
      : String(err).slice(0, 200);
  console.error(LOG_ERR, { empresa_id: empresaId, schema, message });
}

function sumRows(
  rows: Array<{ cantidad_boletos?: number | null; monto_total?: number | string | null; estado_pago?: string | null }>
): { boletos: number; monto: number } {
  let boletos = 0;
  let monto = 0;
  for (const r of rows) {
    if ((r.estado_pago ?? "").trim() === "rechazado") continue;
    boletos += Number(r.cantidad_boletos) || 0;
    monto += Number(r.monto_total) || 0;
  }
  return { boletos, monto };
}

type PgKpiRow = { boletos: string | number | null; monto: string | number | null };

async function fetchKpiWindowFromPg(
  pool: Pool,
  schema: string,
  empresaId: string,
  start: string,
  end: string
): Promise<{ boletos: number; monto: number }> {
  const sch = assertAllowedChatDataSchema(schema);
  const tent = quoteSchemaTable(sch, "sorteo_entradas");
  const tcup = quoteSchemaTable(sch, "sorteo_cupones");

  const [bRes, mRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(c.id) AS boletos
       FROM ${tcup} c
       INNER JOIN ${tent} e ON e.id = c.entrada_id
       WHERE e.empresa_id = $1::uuid
         AND e.created_at >= $2::timestamptz AND e.created_at <= $3::timestamptz
         AND e.estado_pago <> 'rechazado'`,
      [empresaId, start, end]
    ),
    pool.query(
      `SELECT COALESCE(SUM(e.monto_total), 0) AS monto
       FROM ${tent} e
       WHERE e.empresa_id = $1::uuid
         AND e.created_at >= $2::timestamptz AND e.created_at <= $3::timestamptz
         AND e.estado_pago <> 'rechazado'`,
      [empresaId, start, end]
    ),
  ]);

  const bRow = bRes.rows?.[0] as PgKpiRow | undefined;
  const mRow = mRes.rows?.[0] as PgKpiRow | undefined;
  const boletos = Number(bRow?.boletos) || 0;
  const monto = Number(mRow?.monto) || 0;
  return { boletos, monto };
}

export async function getSorteosVentasKpis(): Promise<SorteosVentasKpis> {
  const empty: SorteosVentasKpis = { boletosHoy: 0, boletosMes: 0, montoHoy: 0, montoMes: 0 };

  const catalog = await createSupabaseServerClient();
  const {
    data: { user },
  } = await catalog.auth.getUser();
  if (!user?.email) {
    return empty;
  }

  const { data: urows, error: uErr } = await catalog
    .from("usuarios")
    .select("empresa_id")
    .eq("email", user.email)
    .limit(1);

  const usuario = urows?.[0] as { empresa_id?: string } | undefined;
  if (uErr || !usuario?.empresa_id) {
    return empty;
  }

  const empresaId = usuario.empresa_id as string;
  const schema = await fetchDataSchemaForEmpresaId(empresaId);

  const day = asuncionDayBoundsUtc();
  const month = asuncionMonthBoundsUtc();

  const pool = getChatPostgresPool();
  if (pool) {
    try {
      const [d, m] = await Promise.all([
        fetchKpiWindowFromPg(pool, schema, empresaId, day.start, day.end),
        fetchKpiWindowFromPg(pool, schema, empresaId, month.start, month.end),
      ]);
      return {
        boletosHoy: d.boletos,
        montoHoy: d.monto,
        boletosMes: m.boletos,
        montoMes: m.monto,
      };
    } catch (e) {
      logDashboardError(empresaId, schema, e);
    }
  }

  try {
    const supabase = await getChatServiceClientForEmpresa(empresaId);

    const [dayRes, monthRes] = await Promise.all([
      supabase
        .from("sorteo_entradas")
        .select("cantidad_boletos, monto_total, estado_pago")
        .eq("empresa_id", empresaId)
        .gte("created_at", day.start)
        .lte("created_at", day.end),
      supabase
        .from("sorteo_entradas")
        .select("cantidad_boletos, monto_total, estado_pago")
        .eq("empresa_id", empresaId)
        .gte("created_at", month.start)
        .lte("created_at", month.end),
    ]);

    if (dayRes.error || monthRes.error) {
      logDashboardError(empresaId, schema, dayRes.error ?? monthRes.error);
      return empty;
    }

    const sD = sumRows(dayRes.data ?? []);
    const sM = sumRows(monthRes.data ?? []);
    return {
      boletosHoy: sD.boletos,
      montoHoy: sD.monto,
      boletosMes: sM.boletos,
      montoMes: sM.monto,
    };
  } catch (e) {
    logDashboardError(empresaId, schema, e);
    return empty;
  }
}
