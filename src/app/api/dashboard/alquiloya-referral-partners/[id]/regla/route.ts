import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  tipo?: "porcentaje" | "monto_fijo";
  valor?: number | string;
  moneda?: string | null;
  recurrente?: boolean;
  meses_recurrencia?: number | string | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * POST /api/dashboard/alquiloya-referral-partners/[id]/regla
 *
 * Versiona la regla de comision del partner: cierra la vigente (vigente_hasta=now)
 * y crea una nueva con vigente_desde=now. Si no habia regla previa, solo crea.
 *
 * Body:
 *   tipo: "porcentaje" | "monto_fijo"
 *   valor: numero (>=0). Porcentaje: 0-100. Monto: en la moneda elegida.
 *   moneda: opcional ("PYG" default cuando tipo=monto_fijo). Ignorado si porcentaje.
 *   recurrente: boolean. Si true, requiere meses_recurrencia > 0.
 *   meses_recurrencia: int > 0 (solo si recurrente=true).
 */
export async function POST(request: Request, ctx: Ctx) {
  const user = await getAuthUserForApiRoute(request);
  if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id: partnerId } = await ctx.params;
  if (!uuidRe.test(partnerId)) {
    return NextResponse.json({ error: "id invalido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  const tipo = body.tipo;
  if (tipo !== "porcentaje" && tipo !== "monto_fijo") {
    return NextResponse.json(
      { error: "tipo debe ser 'porcentaje' o 'monto_fijo'" },
      { status: 400 }
    );
  }
  const valor = num(body.valor);
  if (valor === null || valor < 0) {
    return NextResponse.json({ error: "valor debe ser un numero >= 0" }, { status: 400 });
  }
  if (tipo === "porcentaje" && valor > 100) {
    return NextResponse.json({ error: "porcentaje debe estar entre 0 y 100" }, { status: 400 });
  }
  const recurrente = body.recurrente === true;
  let meses: number | null = null;
  if (recurrente) {
    const m = num(body.meses_recurrencia);
    if (m === null || m <= 0 || !Number.isInteger(m)) {
      return NextResponse.json(
        { error: "meses_recurrencia debe ser entero > 0 cuando recurrente=true" },
        { status: 400 }
      );
    }
    meses = m;
  }
  const moneda = tipo === "monto_fijo" ? (body.moneda?.trim() || "PYG") : null;

  const pool = getChatPostgresPool();
  if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Validar que el partner exista en esta empresa.
    const exists = await client.query<{ id: string }>(
      `SELECT id FROM "${SCHEMA}"."referral_partners"
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, partnerId]
    );
    if (exists.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "partner no encontrado" }, { status: 404 });
    }

    // Cierra la regla vigente (si hay).
    await client.query(
      `UPDATE "${SCHEMA}"."referral_commission_rules"
          SET vigente_hasta = now(), updated_at = now()
        WHERE empresa_id=$1::uuid AND partner_id=$2::uuid AND vigente_hasta IS NULL`,
      [ALQUILOYA_EMPRESA_ID, partnerId]
    );

    // Inserta la nueva.
    const ins = await client.query<{ id: string }>(
      `INSERT INTO "${SCHEMA}"."referral_commission_rules"
         (empresa_id, partner_id, tipo, valor, moneda, recurrente, meses_recurrencia, vigente_desde)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, now())
       RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, partnerId, tipo, valor, moneda, recurrente, meses]
    );

    await client.query("COMMIT");
    return NextResponse.json({
      success: true,
      id: ins.rows[0]?.id,
      tipo,
      valor,
      moneda,
      recurrente,
      meses_recurrencia: meses,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[referral-partners/regla] error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error guardando regla" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
