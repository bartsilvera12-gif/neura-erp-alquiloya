import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { sendMail } from "@/lib/email/send-mail";
import { renderAccesoAprobadoEmail } from "@/lib/email/templates/acceso-aprobado";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cache module-level: una vez parcheado el schema (o confirmado que ya esta),
// no volvemos a chequear hasta el proximo cold start.
let planesVencimientoSchemaReady = false;

// Espejo idempotente de supabase/migrations/20260627120000_alquiloya_planes_vencimiento.sql
// Se ejecuta on-demand si las columnas faltan en produccion.
const BOOTSTRAP_PLANES_VENCIMIENTO_SQL = `
ALTER TABLE alquiloya.agentes
  ADD COLUMN IF NOT EXISTS plan_publicacion_id uuid,
  ADD COLUMN IF NOT EXISTS plan_vencimiento_at timestamptz;

ALTER TABLE alquiloya.propietarios
  ADD COLUMN IF NOT EXISTS plan_vencimiento_at timestamptz;

CREATE INDEX IF NOT EXISTS agentes_plan_publicacion_id_idx
  ON alquiloya.agentes (empresa_id, plan_publicacion_id);
CREATE INDEX IF NOT EXISTS propietarios_plan_vencimiento_idx
  ON alquiloya.propietarios (empresa_id, plan_vencimiento_at);
CREATE INDEX IF NOT EXISTS agentes_plan_vencimiento_idx
  ON alquiloya.agentes (empresa_id, plan_vencimiento_at);
`;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}
function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}

type SolicitudFull = {
  id: string;
  empresa_id: string;
  tipo: "agente" | "propietario" | "referido_partner";
  sub_tipo: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  ciudad: string | null;
  mensaje: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  plan_tier_solicitado: string | null;
};

/**
 * Slug seguro para referral_links basado en el nombre del partner.
 * Lowercase, sin acentos, solo [a-z0-9-], colapsa guiones consecutivos.
 */
function slugifyForReferral(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "ref";
}

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
      return NextResponse.json({ error: "action invalida (aprobar|rechazar)" }, { status: 400 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const { rows: solRows } = await queryWithRetry<SolicitudFull>(
      pool,
      `SELECT id, empresa_id, tipo, sub_tipo, nombre, email, telefono,
              empresa, ciudad, mensaje, estado, plan_tier_solicitado
         FROM ${t("solicitudes_acceso")}
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    const sol = solRows?.[0];
    if (!sol) return NextResponse.json({ error: "solicitud no encontrada" }, { status: 404 });
    if (sol.estado !== "pendiente") {
      return NextResponse.json({ error: `solicitud ya ${sol.estado}` }, { status: 409 });
    }

    if (action === "rechazar") {
      const motivo = s(body.motivo_rechazo, 500);
      const { rows } = await queryWithRetry<{ id: string }>(
        pool,
        `UPDATE ${t("solicitudes_acceso")}
            SET estado='rechazada', motivo_rechazo=$3, revisado_por=$4::uuid, revisado_at=now()
          WHERE empresa_id=$1::uuid AND id=$2::uuid
          RETURNING id`,
        [ALQUILOYA_EMPRESA_ID, id, motivo, user.id]
      );
      return NextResponse.json({ success: true, id: rows[0].id, estado: "rechazada" });
    }

    // aprobar → crear agente o propietario y vincular resultado_id

    // Cliente admin para borrar auth.users huérfanos en la pre-validación y
    // para createUser dentro de la transacción.
    const supabaseAdmin = createServiceRoleClient();

    // Pre-validar unicidad de email para agente/referido. Antes del check,
    // limpiamos filas HUÉRFANAS de alquiloya.usuarios — son las que quedan
    // cuando se borra un agente/propietario pero la fila en usuarios (y
    // su auth.users) sobrevive y bloquea reaprobar el mismo email.
    if (sol.email && sol.tipo !== "propietario") {
      const emailLc = sol.email.toLowerCase();

      // 1. Buscar usuarios "fantasma" con este email (agente_id apunta a
      // un agente que ya no existe, o propietario_id idem). Capturamos
      // auth_user_id para borrar también en auth.users.
      const { rows: ghosts } = await queryWithRetry<{ id: string; auth_user_id: string | null }>(
        pool,
        `SELECT u.id, u.auth_user_id::text AS auth_user_id
           FROM ${t("usuarios")} u
          WHERE u.empresa_id=$1::uuid
            AND lower(u.email)=$2
            AND (
              (u.agente_id IS NOT NULL AND NOT EXISTS (
                 SELECT 1 FROM ${t("agentes")} a WHERE a.id = u.agente_id))
              OR (u.propietario_id IS NOT NULL AND NOT EXISTS (
                 SELECT 1 FROM ${t("propietarios")} p WHERE p.id = u.propietario_id))
              OR (u.agente_id IS NULL AND u.propietario_id IS NULL AND COALESCE(u.activo, false) = false)
            )`,
        [ALQUILOYA_EMPRESA_ID, emailLc]
      );
      for (const g of ghosts) {
        try {
          await queryWithRetry(
            pool,
            `DELETE FROM ${t("usuarios")} WHERE id = $1::uuid`,
            [g.id]
          );
        } catch (e) {
          console.warn("[solicitudes-acceso] no se pudo borrar usuario huérfano:", e instanceof Error ? e.message : e);
        }
        if (g.auth_user_id) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(g.auth_user_id);
          } catch (e) {
            console.warn("[solicitudes-acceso] no se pudo borrar auth.user huérfano:", e instanceof Error ? e.message : e);
          }
        }
      }

      // 2. Ahora sí, chequeo de duplicados reales.
      const { rows: dup } = await queryWithRetry<{ source: string }>(
        pool,
        `(SELECT 'usuarios' AS source FROM ${t("usuarios")}
            WHERE empresa_id=$1::uuid AND lower(email)=$2 LIMIT 1)
         UNION ALL
         (SELECT 'agentes' FROM ${t("agentes")}
            WHERE empresa_id=$1::uuid AND lower(email)=$2 LIMIT 1)
         UNION ALL
         (SELECT 'propietarios' FROM ${t("propietarios")}
            WHERE empresa_id=$1::uuid AND lower(email)=$2 LIMIT 1)`,
        [ALQUILOYA_EMPRESA_ID, emailLc]
      );
      if (dup.length > 0) {
        return NextResponse.json(
          {
            error:
              `El email "${sol.email}" ya está registrado en ${dup[0].source}. ` +
              `Pediles que usen otro correo o resolvé el duplicado antes de aprobar.`,
          },
          { status: 409 }
        );
      }
    }

    // Bootstrap on-demand de las columnas plan_vencimiento_at /
    // plan_publicacion_id en agentes/propietarios. La migracion canonica
    // (20260627120000_alquiloya_planes_vencimiento.sql) no esta aplicada en
    // todas las DBs de produccion — sin esto el INSERT mas abajo fallaba con
    // "column plan_vencimiento_at of relation propietarios does not exist".
    // Toda la DDL es idempotente (ALTER TABLE / CREATE INDEX IF NOT EXISTS).
    if (!planesVencimientoSchemaReady) {
      try {
        await queryWithRetry(pool, BOOTSTRAP_PLANES_VENCIMIENTO_SQL, []);
        planesVencimientoSchemaReady = true;
      } catch (bootErr) {
        const code = (bootErr as { code?: string })?.code ?? "";
        console.error(
          "[api/dashboard/alquiloya-solicitudes-acceso] bootstrap fail",
          "code=" + code,
          bootErr instanceof Error ? bootErr.message : bootErr
        );
        return NextResponse.json(
          {
            error:
              "No pudimos preparar el schema de planes. Avisa al admin." +
              (code ? ` (codigo ${code})` : ""),
          },
          { status: 503 }
        );
      }
    }

    const client = await pool.connect();
    // Declarado fuera del try para que el catch pueda compensar el auth.user
    // creado si la transacción del ERP falla.
    let createdAuthUserId: string | null = null;
    try {
      await client.query("BEGIN");

      // Resolver plan tier → uuid + billing para calcular vencimiento.
      let planId: string | null = null;
      let billing = "";
      if (sol.plan_tier_solicitado) {
        const pr = await client.query<{ id: string; billing: string | null }>(
          `SELECT id, billing FROM ${t("planes_publicacion")}
            WHERE empresa_id = $1::uuid AND tier = $2 AND activo = true LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, sol.plan_tier_solicitado]
        );
        planId = pr.rows[0]?.id ?? null;
        billing = (pr.rows[0]?.billing ?? "").toLowerCase();
      }
      const vencSql =
        !planId || billing === "gratis"
          ? "NULL"
          : billing === "anual"
            ? "now() + interval '365 days'"
            : "now() + interval '30 days'";

      let resultadoId: string;
      // partnerSlug solo aplica a referido_partner — lo necesitamos despues
      // del INSERT en referral_partners para crear el referral_link.
      let partnerSlugRef: string | null = null;
      if (sol.tipo === "agente") {
        const cargo = sol.sub_tipo ?? "Independiente";
        const r = await client.query<{ id: string }>(
          `INSERT INTO ${t("agentes")}
             (empresa_id, nombre, email, telefono, whatsapp, cargo, activo,
              plan_publicacion_id, plan_vencimiento_at)
           VALUES ($1::uuid, $2, $3, $4, $4, $5, true, $6, ${vencSql})
           RETURNING id`,
          [ALQUILOYA_EMPRESA_ID, sol.nombre, sol.email, sol.telefono, cargo, planId]
        );
        resultadoId = r.rows[0].id;
      } else if (sol.tipo === "propietario") {
        const r = await client.query<{ id: string }>(
          `INSERT INTO ${t("propietarios")}
             (empresa_id, nombre, email, telefono, tipo_persona, estado, activo,
              plan_publicacion_id, plan_vencimiento_at)
           VALUES ($1::uuid, $2, $3, $4, 'fisica', 'verificado', true, $5, ${vencSql})
           RETURNING id`,
          [ALQUILOYA_EMPRESA_ID, sol.nombre, sol.email, sol.telefono, planId]
        );
        resultadoId = r.rows[0].id;
      } else {
        // sol.tipo === 'referido_partner'
        // Crear partner + link unico con slug autogenerado + regla por defecto (10% recurrente 12m, tier 'estandar').
        const baseSlug = slugifyForReferral(sol.nombre);
        // Buscamos un slug libre: base, base-2, base-3, ...
        let candidate = baseSlug;
        for (let i = 2; i <= 30; i++) {
          const { rows: clash } = await client.query<{ id: string }>(
            `SELECT id FROM ${t("referral_links")}
              WHERE empresa_id = $1::uuid AND lower(slug) = lower($2) LIMIT 1`,
            [ALQUILOYA_EMPRESA_ID, candidate]
          );
          if (!clash || clash.length === 0) break;
          candidate = `${baseSlug}-${i}`;
        }
        partnerSlugRef = candidate;

        const rp = await client.query<{ id: string }>(
          `INSERT INTO ${t("referral_partners")}
             (empresa_id, nombre, email, telefono, tipo, notas, activo)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, true)
           RETURNING id`,
          [
            ALQUILOYA_EMPRESA_ID,
            sol.nombre,
            sol.email,
            sol.telefono,
            sol.sub_tipo ?? "otro", // canal: instagram/tiktok/whatsapp/web/otro
            sol.mensaje,
          ]
        );
        resultadoId = rp.rows[0].id;

        const rl = await client.query<{ id: string }>(
          `INSERT INTO ${t("referral_links")}
             (empresa_id, partner_id, slug, campania, cookie_dias, activo)
           VALUES ($1::uuid, $2::uuid, $3, $4, 60, true)
           RETURNING id`,
          [ALQUILOYA_EMPRESA_ID, resultadoId, partnerSlugRef, null]
        );
        await client.query(
          `INSERT INTO ${t("referral_commission_rules")}
             (empresa_id, partner_id, link_id, tipo, valor, moneda,
              recurrente, meses_recurrencia, vigente_desde)
           VALUES ($1::uuid, $2::uuid, $3::uuid, 'porcentaje', 10, NULL,
                   true, 12, now())`,
          [ALQUILOYA_EMPRESA_ID, resultadoId, rl.rows[0].id]
        );
      }

      // Crear cuenta de acceso (auth.users + alquiloya.usuarios) + correo SOLO
      // para quienes entran a un portal: AGENTES y REFERIDOS. Los PROPIETARIOS
      // NO inician sesion en ningun portal, asi que se aprueban solo como
      // registro en alquiloya.propietarios (ya creado arriba) — sin cuenta de
      // login y sin correo de acceso. (Pedido del cliente: el acceso es solo
      // para agentes.)
      let portalCredentials: { email: string; tempPassword: string } | null = null;
      let emailSent = false; // true si pudimos disparar el correo automatico
      let emailError: string | null = null;
      let usuarioErpId: string | null = null;
      const creaAcceso = sol.tipo !== "propietario";
      if (sol.email && creaAcceso) {
        // Genera password temporal (12 chars alfanumericos + 2 simbolos).
        const tempPassword =
          crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x").slice(0, 12) + "!9";
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: sol.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            nombre: sol.nombre,
            fuente: "solicitud_acceso",
            tipo: sol.tipo,
          },
        });
        if (createErr) {
          const msg = (createErr.message ?? "").toLowerCase();
          const isDup =
            msg.includes("already") || msg.includes("exists") || msg.includes("registered");
          throw new Error(
            isDup
              ? `El email "${sol.email}" ya tiene cuenta en Auth. ` +
                  `Borralo en Supabase Dashboard → Authentication → Users o usá otro email.`
              : `No pudimos crear la cuenta de portal: ${createErr.message}`
          );
        }
        if (!created.user?.id) throw new Error("no se pudo crear el auth.user");

        const authUserId = created.user.id;
        createdAuthUserId = authUserId;
        {
          const rol =
            sol.tipo === "agente"
              ? "publicador-agente"
              : sol.tipo === "propietario"
                ? "publicador-propietario"
                : "referido_partner";

          // Columna a vincular en usuarios segun el tipo (NULL para referido,
          // se vincula despues por referral_partners.usuario_id).
          let insertUsuario;
          if (sol.tipo === "agente") {
            insertUsuario = await client.query<{ id: string }>(
              `INSERT INTO ${t("usuarios")}
                 (empresa_id, auth_user_id, email, nombre, rol, agente_id)
               VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
               RETURNING id`,
              [ALQUILOYA_EMPRESA_ID, authUserId, sol.email, sol.nombre, rol, resultadoId]
            );
          } else if (sol.tipo === "propietario") {
            insertUsuario = await client.query<{ id: string }>(
              `INSERT INTO ${t("usuarios")}
                 (empresa_id, auth_user_id, email, nombre, rol, propietario_id)
               VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
               RETURNING id`,
              [ALQUILOYA_EMPRESA_ID, authUserId, sol.email, sol.nombre, rol, resultadoId]
            );
          } else {
            insertUsuario = await client.query<{ id: string }>(
              `INSERT INTO ${t("usuarios")}
                 (empresa_id, auth_user_id, email, nombre, rol)
               VALUES ($1::uuid, $2::uuid, $3, $4, $5)
               RETURNING id`,
              [ALQUILOYA_EMPRESA_ID, authUserId, sol.email, sol.nombre, rol]
            );
          }
          usuarioErpId = insertUsuario.rows[0]?.id ?? null;

          // Para referido: vinculamos referral_partners.usuario_id para que
          // /api/referido/me pueda resolver el partner por usuario.
          if (sol.tipo === "referido_partner" && usuarioErpId) {
            await client.query(
              `UPDATE ${t("referral_partners")}
                  SET usuario_id = $1::uuid, updated_at = now()
                WHERE empresa_id = $2::uuid AND id = $3::uuid`,
              [usuarioErpId, ALQUILOYA_EMPRESA_ID, resultadoId]
            );
          }

          portalCredentials = { email: sol.email, tempPassword };

          // Enviar correo directo via SMTP (Hostinger u otro). No depende de
          // Supabase SMTP. Si las variables SMTP_* no estan seteadas, sendMail
          // devuelve {sent:false} sin romper, y el admin comparte manualmente.
          try {
            const origin = new URL(request.url).origin;
            const portalPath =
              sol.tipo === "referido_partner"
                ? "/portal-referidos/login"
                : "/portal-agentes/login";
            const portalUrl = `${origin}${portalPath}`;
            const tpl = renderAccesoAprobadoEmail({
              nombre: sol.nombre,
              email: sol.email,
              password: tempPassword,
              portalUrl,
            });
            const result = await sendMail({
              to: sol.email,
              subject: tpl.subject,
              html: tpl.html,
              text: tpl.text,
            });
            if (result.sent) {
              emailSent = true;
            } else {
              emailError = result.reason;
              console.warn("[solicitudes-acceso] sendMail no envió:", result.reason);
            }
          } catch (e) {
            emailError = e instanceof Error ? e.message : "Error enviando mail";
            console.warn("[solicitudes-acceso] excepción en sendMail:", emailError);
          }
        }
      }

      const upd = await client.query<{ id: string }>(
        `UPDATE ${t("solicitudes_acceso")}
            SET estado='aprobada', resultado_id=$3::uuid,
                revisado_por=$4::uuid, revisado_at=now()
          WHERE empresa_id=$1::uuid AND id=$2::uuid
          RETURNING id`,
        [ALQUILOYA_EMPRESA_ID, id, resultadoId, user.id]
      );

      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        id: upd.rows[0].id,
        estado: "aprobada",
        resultado_id: resultadoId,
        tipo: sol.tipo,
        portal_credentials: portalCredentials, // {email, tempPassword} | null
        email_sent: emailSent,
        email_error: emailError,
        usuario_erp_id: usuarioErpId,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      // Si llegamos a crear el auth.user pero la transacción del ERP falló,
      // borramos el auth.user para no dejar cuentas huérfanas.
      if (createdAuthUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
        } catch {
          /* best-effort */
        }
      }
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api/dashboard/alquiloya-solicitudes-acceso/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
