import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { getClientSchema } from "@/lib/env/instance-mode";
import { bustOverviewCache } from "@/lib/cache/dashboard-overview-cache";
import { sendMail } from "@/lib/email/send-mail";
import { renderPlanAprobadoEmail } from "@/lib/email/templates/plan-aprobado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

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

/** Misma politica que el flujo de aprobacion de solicitudes_acceso. */
function generateTempPassword(): string {
  return (
    crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x").slice(0, 12) + "!9"
  );
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

/**
 * Resuelve un propietario para vincular a la solicitud cuando el admin no
 * eligio uno explicito en el modal. Estrategia:
 *   1) match exacto por email (case-insensitive)
 *   2) match exacto por telefono
 *   3) si pidio crear_propietario, INSERT nuevo con los datos de la solicitud
 * Devuelve { id, created } o null. `created=true` solo cuando insertamos
 * una fila nueva (sirve para disparar el flujo de creacion de cuenta).
 */
async function resolveOrCreatePropietario(
  client: import("pg").PoolClient,
  sol: Sol,
  crearPropietario: boolean
): Promise<{ id: string; created: boolean } | null> {
  if (sol.email) {
    const m = await client.query<{ id: string }>(
      `SELECT id FROM ${t("propietarios")}
        WHERE empresa_id=$1::uuid AND lower(email)=lower($2) LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, sol.email]
    );
    if (m.rows[0]?.id) return { id: m.rows[0].id, created: false };
  }
  if (sol.telefono) {
    const m = await client.query<{ id: string }>(
      `SELECT id FROM ${t("propietarios")}
        WHERE empresa_id=$1::uuid AND telefono=$2 LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, sol.telefono]
    );
    if (m.rows[0]?.id) return { id: m.rows[0].id, created: false };
  }
  if (!crearPropietario) return null;
  const ins = await client.query<{ id: string }>(
    `INSERT INTO ${t("propietarios")}
       (empresa_id, nombre, email, telefono, activo)
     VALUES ($1::uuid, $2, $3, $4, true)
     RETURNING id`,
    [ALQUILOYA_EMPRESA_ID, sol.nombre, sol.email, sol.telefono]
  );
  return { id: ins.rows[0].id, created: true };
}

/**
 * Crea cuenta de portal para un propietario recien creado. Idempotente:
 * si el email ya existe en Supabase Auth, no hace nada y devuelve null
 * (asumimos que el usuario ya tiene como ingresar y le mandamos solo el
 * mail de plan aprobado sin credenciales).
 */
async function provisionPortalAccountForPropietario(params: {
  pool: import("pg").Pool;
  propietarioId: string;
  nombre: string;
  email: string;
}): Promise<{ tempPassword: string } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRole) {
    console.warn("[provisionPortalAccount] faltan SUPABASE_* envs");
    return null;
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tempPassword = generateTempPassword();
  const { data: created, error: createErr } =
    await supabaseAdmin.auth.admin.createUser({
      email: params.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        nombre: params.nombre,
        fuente: "solicitud_servicio_aprobada",
        tipo: "propietario",
      },
    });

  let authUserId: string | null = null;
  if (createErr) {
    const msg = (createErr.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
      // El email ya estaba en Supabase Auth (probablemente de pruebas previas).
      // Buscamos el auth user y le reseteamos la password para que llegue una
      // nueva valida al solicitante.
      const lower = params.email.toLowerCase();
      for (let page = 1; page <= 50 && !authUserId; page++) {
        const { data: lr, error: le } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (le) { console.warn("[provisionPortalAccount] listUsers:", le.message); break; }
        const users = lr?.users ?? [];
        if (users.length === 0) break;
        const hit = users.find((u: { id?: string; email?: string | null }) => (u.email ?? "").toLowerCase() === lower);
        if (hit && hit.id) { authUserId = hit.id; break; }
        if (users.length < 1000) break;
      }
      if (!authUserId) {
        console.warn("[provisionPortalAccount] no encontre el auth user existente para reset:", params.email);
        return null;
      }
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nombre: params.nombre, fuente: "solicitud_servicio_aprobada_reset", tipo: "propietario" },
      });
      if (upErr) {
        console.warn("[provisionPortalAccount] updateUserById:", upErr.message);
        return null;
      }
      console.info("[provisionPortalAccount] password reseteada para auth user existente:", params.email);
    } else {
      console.warn("[provisionPortalAccount] createUser:", createErr.message);
      return null;
    }
  } else {
    authUserId = created.user?.id ?? null;
    if (!authUserId) return null;
  }

  // Vinculo en alquiloya.usuarios. Si la fila ya existe (por algun otro
  // flujo, ej. solicitudes-acceso), no la duplicamos.
  try {
    const { rows: existing } = await params.pool.query<{ id: string }>(
      `SELECT id FROM "alquiloya"."usuarios"
        WHERE empresa_id=$1::uuid AND auth_user_id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, authUserId]
    );
    if (existing.length === 0) {
      await params.pool.query(
        `INSERT INTO "alquiloya"."usuarios"
           (empresa_id, auth_user_id, email, nombre, rol, propietario_id)
         VALUES ($1::uuid, $2::uuid, $3, $4, 'publicador-propietario', $5::uuid)`,
        [ALQUILOYA_EMPRESA_ID, authUserId, params.email, params.nombre, params.propietarioId]
      );
    } else {
      // Si ya existia, nos aseguramos que apunte al propietario nuevo.
      await params.pool.query(
        `UPDATE "alquiloya"."usuarios" SET propietario_id=$2::uuid, updated_at=now()
          WHERE empresa_id=$1::uuid AND id=$3::uuid`,
        [ALQUILOYA_EMPRESA_ID, params.propietarioId, existing[0].id]
      );
    }
    await params.pool.query(
      `UPDATE "alquiloya"."propietarios"
          SET usuario_id = (
                SELECT id FROM "alquiloya"."usuarios"
                 WHERE auth_user_id = $1::uuid LIMIT 1
              ),
              updated_at = now()
        WHERE empresa_id = $2::uuid AND id = $3::uuid`,
      [authUserId, ALQUILOYA_EMPRESA_ID, params.propietarioId]
    );
  } catch (e) {
    console.warn(
      "[provisionPortalAccount] insert usuarios:",
      e instanceof Error ? e.message : e
    );
  }

  return { tempPassword };
}

function vencimientoTextoFromBilling(billing: string): string | null {
  const d = new Date();
  if (billing === "gratis") return null;
  if (billing === "anual") d.setDate(d.getDate() + 365);
  else d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("es-PY", { dateStyle: "long" });
}

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
    const crearPropietario = body.crear_propietario === true;

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

    const overridePropietarioRaw = uuid(body.propietario_id) ?? sol.propietario_id;
    const overridePropiedad = uuid(body.propiedad_id) ?? sol.propiedad_id;
    const overrideAgente = uuid(body.agente_id) ?? sol.agente_id;

    const client = await pool.connect();
    let effectivePropietarioId: string | null = overridePropietarioRaw;
    let propietarioWasJustCreated = false;
    let appliedPlan: { nombre: string | null; tier: string; vencimientoTexto: string | null } | null = null;
    let appliedImpulsos: number | null = null;
    let resultadoId: string | null = null;

    try {
      await client.query("BEGIN");

      if (!effectivePropietarioId && !overrideAgente && crearPropietario) {
        const r = await resolveOrCreatePropietario(client, sol, true);
        if (r) {
          effectivePropietarioId = r.id;
          propietarioWasJustCreated = r.created;
        }
      }

      if (sol.kind === "cambio_plan") {
        if (!sol.plan_tier) throw new Error("la solicitud no tiene plan_tier");
        const pr = await client.query<{ id: string; billing: string | null; nombre: string | null }>(
          `SELECT id, billing, nombre FROM ${t("planes_publicacion")}
            WHERE empresa_id=$1::uuid AND tier=$2 AND activo=true LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, sol.plan_tier]
        );
        const planRow = pr.rows[0];
        if (!planRow?.id) throw new Error(`plan "${sol.plan_tier}" no existe`);
        const planId = planRow.id;
        const billing = (planRow.billing ?? "").toLowerCase();
        const vencSql =
          billing === "gratis"
            ? "NULL"
            : billing === "anual"
              ? "now() + interval '365 days'"
              : "now() + interval '30 days'";
        const vencimientoTexto = vencimientoTextoFromBilling(billing);
        appliedPlan = {
          nombre: planRow.nombre,
          tier: sol.plan_tier,
          vencimientoTexto,
        };

        if (effectivePropietarioId) {
          await client.query(
            `UPDATE ${t("propietarios")}
                SET plan_publicacion_id=$3::uuid,
                    plan_vencimiento_at=${vencSql},
                    updated_at=now()
              WHERE empresa_id=$1::uuid AND id=$2::uuid`,
            [ALQUILOYA_EMPRESA_ID, effectivePropietarioId, planId]
          );
          resultadoId = effectivePropietarioId;
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
          throw new Error(
            "Necesitás indicar propietario_id (o agente_id) al aprobar el cambio de plan. " +
              "Tildá 'Crear propietario con los datos de la solicitud' si el solicitante no está registrado."
          );
        }
      }

      if (sol.kind === "impulsos") {
        const qty = sol.pack_qty ?? 0;
        if (qty <= 0) throw new Error("pack_qty inválido");
        appliedImpulsos = qty;

        if (effectivePropietarioId) {
          await client.query(
            `UPDATE ${t("propietarios")}
                SET impulsos_saldo = COALESCE(impulsos_saldo, 0) + $3, updated_at=now()
              WHERE empresa_id=$1::uuid AND id=$2::uuid`,
            [ALQUILOYA_EMPRESA_ID, effectivePropietarioId, qty]
          );
          resultadoId = effectivePropietarioId;
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
            "Necesitás indicar propietario_id o agente_id al aprobar la compra de impulsos. " +
              "Tildá 'Crear propietario con los datos de la solicitud' si el solicitante no está registrado."
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

      await client.query(
        `UPDATE ${t("solicitudes_servicio")}
            SET estado='aprobada',
                resultado_id = $3::uuid,
                propietario_id = COALESCE(propietario_id, $4::uuid),
                propiedad_id = COALESCE(propiedad_id, $5::uuid),
                agente_id = COALESCE(agente_id, $6::uuid),
                revisado_por = $7::uuid, revisado_at = now()
          WHERE empresa_id=$1::uuid AND id=$2::uuid`,
        [
          ALQUILOYA_EMPRESA_ID, id, resultadoId,
          effectivePropietarioId, overridePropiedad, overrideAgente,
          user.id,
        ]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    // ───── post-commit: cuenta de portal + correo de aprobacion ─────
    // Solo si creamos un propietario nuevo Y tenemos email valido. Si fallan
    // estos pasos, ya esta aplicado el cambio en BD; el admin puede reenviar
    // el correo manualmente desde el panel de Solicitudes de acceso.
    let credentialsCreated: { email: string; password: string } | null = null;
    let mailSent = false;
    let mailError: string | null = null;

    const shouldNotify =
      !!sol.email && (propietarioWasJustCreated || sol.kind !== "verificacion");

    if (effectivePropietarioId && propietarioWasJustCreated && sol.email) {
      try {
        const acc = await provisionPortalAccountForPropietario({
          pool,
          propietarioId: effectivePropietarioId,
          nombre: sol.nombre,
          email: sol.email,
        });
        if (acc) credentialsCreated = { email: sol.email, password: acc.tempPassword };
      } catch (e) {
        console.warn(
          "[solicitudes-servicio PATCH] provision portal:",
          e instanceof Error ? e.message : e
        );
      }
    }

    if (!shouldNotify || !sol.email) {
      console.log("[solicitudes-servicio PATCH] mail NO disparado - shouldNotify:", shouldNotify, "sol.email:", sol.email);
    }
    if (shouldNotify && sol.email) {
      try {
        const origin = new URL(request.url).origin;
        const portalUrl = `${origin}/portal-agentes/login`;
        const tpl = renderPlanAprobadoEmail({
          nombre: sol.nombre,
          planNombre: appliedPlan?.nombre ?? null,
          planTier: appliedPlan?.tier ?? null,
          vencimientoTexto: appliedPlan?.vencimientoTexto ?? null,
          impulsosCantidad: appliedImpulsos,
          credentials: credentialsCreated
            ? { ...credentialsCreated, portalUrl }
            : undefined,
        });
        console.log("[solicitudes-servicio PATCH] enviando mail a:", sol.email, "subject:", tpl.subject);
        const r = await sendMail({
          to: sol.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        });
        if (r.sent) {
          mailSent = true;
          console.log("[solicitudes-servicio PATCH] sendMail OK messageId:", r.messageId);
        } else {
          mailError = r.reason;
          console.warn("[solicitudes-servicio PATCH] sendMail NO ENVIADO:", r.reason);
        }
      } catch (e) {
        mailError = e instanceof Error ? e.message : "Error enviando mail";
        console.warn("[solicitudes-servicio PATCH] sendMail:", mailError);
      }
    }

    bustOverviewCache(
      getClientSchema(),
      process.env.NEURA_CLIENT_EMPRESA_ID?.trim() || ALQUILOYA_EMPRESA_ID
    );

    return NextResponse.json({
      success: true,
      id,
      estado: "aprobada",
      resultado_id: resultadoId,
      kind: sol.kind,
      propietario_id: effectivePropietarioId,
      propietario_creado: propietarioWasJustCreated,
      cuenta_portal_creada: !!credentialsCreated,
      mail_enviado: mailSent,
      mail_error: mailError,
    });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-solicitudes-servicio/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
