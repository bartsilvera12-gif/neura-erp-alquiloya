import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { getClientSchema } from "@/lib/env/instance-mode";
import { bustOverviewCache } from "@/lib/cache/dashboard-overview-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

// Bootstrap idempotente: agregamos `impulsos_saldo` a alquiloya.agentes si
// todavia no existe. Antes la columna solo vivia en `propietarios` (migration
// 20260626120000), asi que cuando un agente compraba impulsos no habia donde
// acreditarselos. ADD COLUMN IF NOT EXISTS es seguro de correr varias veces.
let agentesImpulsosColumnReady = false;
async function ensureAgentesImpulsosColumn(pool: import("pg").Pool): Promise<void> {
  if (agentesImpulsosColumnReady) return;
  try {
    await pool.query(
      `ALTER TABLE "alquiloya"."agentes"
         ADD COLUMN IF NOT EXISTS impulsos_saldo int NOT NULL DEFAULT 0`
    );
    agentesImpulsosColumnReady = true;
  } catch (e) {
    console.warn(
      "[ensureAgentesImpulsosColumn] no se pudo bootstrap:",
      e instanceof Error ? e.message : e
    );
  }
}
function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}
function uuid(v: unknown): string | null {
  const x = s(v, 40);
  return x && uuidRe.test(x) ? x : null;
}

type Sol = {
  id: string;
  kind: "cambio_plan" | "impulsos" | "verificacion";
  nombre: string;
  email: string | null;
  telefono: string | null;
  propiedad_id: string | null;
  propietario_id: string | null;
  agente_id: string | null;
  plan_tier: string | null;
  pack_qty: number | null;
  estado: "pendiente" | "aprobada" | "rechazada";
};

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = s(body.action, 20);
    if (action !== "aprobar" && action !== "rechazar") {
      return NextResponse.json({ error: "action invalida" }, { status: 400 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const { rows: srows } = await queryWithRetry<Sol>(
      pool,
      `SELECT id, kind, nombre, email, telefono, propiedad_id, propietario_id, agente_id,
              plan_tier, pack_qty, estado
         FROM ${t("solicitudes_servicio")}
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    const sol = srows?.[0];
    if (!sol) return NextResponse.json({ error: "no encontrada" }, { status: 404 });
    if (sol.estado !== "pendiente") {
      return NextResponse.json({ error: `solicitud ya ${sol.estado}` }, { status: 409 });
    }

    if (action === "rechazar") {
      const motivo = s(body.motivo_rechazo, 500);
      const r = await queryWithRetry<{ id: string }>(
        pool,
        `UPDATE ${t("solicitudes_servicio")}
            SET estado='rechazada', motivo_rechazo=$3, revisado_por=$4::uuid, revisado_at=now()
          WHERE empresa_id=$1::uuid AND id=$2::uuid
          RETURNING id`,
        [ALQUILOYA_EMPRESA_ID, id, motivo, user.id]
      );
      bustOverviewCache(
        getClientSchema(),
        process.env.NEURA_CLIENT_EMPRESA_ID?.trim() || ALQUILOYA_EMPRESA_ID
      );
      return NextResponse.json({ success: true, id: r.rows[0].id, estado: "rechazada" });
    }

    // ───── APROBAR ─────
    // El admin puede pasar overrides en el body para resolver vinculos:
    //   propietario_id, propiedad_id (para verificacion + impulsos), agente_id (para cambio_plan agente)
    const overridePropietario = uuid(body.propietario_id) ?? sol.propietario_id;
    const overridePropiedad = uuid(body.propiedad_id) ?? sol.propiedad_id;
    const overrideAgente = uuid(body.agente_id) ?? sol.agente_id;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let resultadoId: string | null = null;

      if (sol.kind === "cambio_plan") {
        if (!sol.plan_tier) throw new Error("la solicitud no tiene plan_tier");
        const pr = await client.query<{ id: string; billing: string | null }>(
          `SELECT id, billing FROM ${t("planes_publicacion")}
            WHERE empresa_id=$1::uuid AND tier=$2 AND activo=true LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, sol.plan_tier]
        );
        const planRow = pr.rows[0];
        if (!planRow?.id) throw new Error(`plan "${sol.plan_tier}" no existe`);
        const planId = planRow.id;
        // vencimiento segun billing: gratis = null, unico/mensual = +30d, anual = +365d
        const billing = (planRow.billing ?? "").toLowerCase();
        const vencSql =
          billing === "gratis"
            ? "NULL"
            : billing === "anual"
              ? "now() + interval '365 days'"
              : "now() + interval '30 days'";

        if (overridePropietario) {
          await client.query(
            `UPDATE ${t("propietarios")}
                SET plan_publicacion_id=$3::uuid,
                    plan_vencimiento_at=${vencSql},
                    updated_at=now()
              WHERE empresa_id=$1::uuid AND id=$2::uuid`,
            [ALQUILOYA_EMPRESA_ID, overridePropietario, planId]
          );
          resultadoId = overridePropietario;
        } else if (overrideAgente) {
          await client.query(
            `UPDATE ${t("agentes")}
                SET plan_publicacion_id=$3::uuid,
                    plan_vencimiento_at=${vencSql},
                    updated_at=now()
              WHERE empresa_id=$1::uuid AND id=$2::uuid`,
            [ALQUILOYA_EMPRESA_ID, overrideAgente, planId]
          );
          resultadoId = overrideAgente;
        } else {
          throw new Error("Necesitás indicar propietario_id (o agente_id) al aprobar el cambio de plan");
        }
      }

      if (sol.kind === "impulsos") {
        const qty = sol.pack_qty ?? 0;
        if (qty <= 0) throw new Error("pack_qty inválido");
        // Los impulsos se pueden acreditar a un propietario O a un agente. Antes
        // siempre iba al propietario y los agentes nunca recibian su saldo.
        if (overridePropietario) {
          await client.query(
            `UPDATE ${t("propietarios")}
                SET impulsos_saldo = COALESCE(impulsos_saldo, 0) + $3, updated_at=now()
              WHERE empresa_id=$1::uuid AND id=$2::uuid`,
            [ALQUILOYA_EMPRESA_ID, overridePropietario, qty]
          );
          resultadoId = overridePropietario;
        } else if (overrideAgente) {
          await ensureAgentesImpulsosColumn(pool);
          await client.query(
            `UPDATE ${t("agentes")}
                SET impulsos_saldo = COALESCE(impulsos_saldo, 0) + $3, updated_at=now()
              WHERE empresa_id=$1::uuid AND id=$2::uuid`,
            [ALQUILOYA_EMPRESA_ID, overrideAgente, qty]
          );
          resultadoId = overrideAgente;
        } else {
          throw new Error(
            "Necesitás indicar propietario_id o agente_id al aprobar la compra de impulsos"
          );
        }
      }

      if (sol.kind === "verificacion") {
        if (!overridePropiedad) {
          throw new Error("Necesitás indicar propiedad_id al aprobar la verificación");
        }
        await client.query(
          `UPDATE ${t("propiedades")}
              SET verificada = true, updated_at=now()
            WHERE empresa_id=$1::uuid AND id=$2::uuid`,
          [ALQUILOYA_EMPRESA_ID, overridePropiedad]
        );
        resultadoId = overridePropiedad;
      }

      const upd = await client.query<{ id: string }>(
        `UPDATE ${t("solicitudes_servicio")}
            SET estado='aprobada',
                resultado_id = $3::uuid,
                propietario_id = COALESCE(propietario_id, $4::uuid),
                propiedad_id = COALESCE(propiedad_id, $5::uuid),
                agente_id = COALESCE(agente_id, $6::uuid),
                revisado_por = $7::uuid, revisado_at = now()
          WHERE empresa_id=$1::uuid AND id=$2::uuid
          RETURNING id`,
        [
          ALQUILOYA_EMPRESA_ID, id, resultadoId,
          overridePropietario, overridePropiedad, overrideAgente,
          user.id,
        ]
      );
      await client.query("COMMIT");
      bustOverviewCache(
        getClientSchema(),
        process.env.NEURA_CLIENT_EMPRESA_ID?.trim() || ALQUILOYA_EMPRESA_ID
      );
      return NextResponse.json({
        success: true,
        id: upd.rows[0].id,
        estado: "aprobada",
        resultado_id: resultadoId,
        kind: sol.kind,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api/dashboard/alquiloya-solicitudes-servicio/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
