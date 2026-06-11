import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const ALQUILOYA_SCHEMA = "alquiloya";

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}
function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}
function normPhone(p: string): string {
  return p.replace(/[^0-9+]/g, "");
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const nombre = s(body.nombre, 160);
    const email = s(body.email, 160)?.toLowerCase() ?? null;
    const telefonoRaw = s(body.telefono, 40);
    const ciudad = s(body.ciudad, 80);
    const password = typeof body.password === "string" ? body.password : "";

    if (!nombre) {
      return NextResponse.json(errorResponse("Ingresá tu nombre completo."), { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(errorResponse("Email inválido."), { status: 400 });
    }
    if (!telefonoRaw) {
      return NextResponse.json(errorResponse("Teléfono requerido."), { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(errorResponse("La contraseña debe tener al menos 8 caracteres."), { status: 400 });
    }
    const telefono = telefonoRaw;
    const telefonoNorm = normPhone(telefonoRaw);

    const pool = getChatPostgresPool();
    if (!pool) {
      return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });
    }

    // Cliente admin para limpiar auth.users huerfanos antes del check de
    // duplicados y para crear el auth.user definitivo despues.
    const supabaseAdmin = createServiceRoleClient();

    // 0) Limpieza de huerfanos: si el email vive en alquiloya.usuarios pero
    // su propietario_id apunta a una fila que ya no existe (admin borro al
    // propietario sin cascada), borramos esa fila y su auth.users para
    // permitir reusar el correo. Misma logica que la aprobacion de agentes.
    const { rows: ghosts } = await queryWithRetry<{ id: string; auth_user_id: string | null }>(
      pool,
      `SELECT u.id, u.auth_user_id::text AS auth_user_id
         FROM ${t("usuarios")} u
        WHERE u.empresa_id=$1::uuid
          AND lower(u.email)=lower($2)
          AND (
            (u.propietario_id IS NOT NULL AND NOT EXISTS (
               SELECT 1 FROM ${t("propietarios")} p WHERE p.id = u.propietario_id))
            OR (u.agente_id IS NOT NULL AND NOT EXISTS (
               SELECT 1 FROM ${t("agentes")} a WHERE a.id = u.agente_id))
          )`,
      [ALQUILOYA_EMPRESA_ID, email]
    );
    for (const g of ghosts) {
      try {
        await queryWithRetry(
          pool,
          `DELETE FROM ${t("usuarios")} WHERE id = $1::uuid`,
          [g.id]
        );
      } catch (e) {
        console.warn(
          "[registro-propietario] no se pudo borrar usuario huerfano:",
          e instanceof Error ? e.message : e
        );
      }
      if (g.auth_user_id) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(g.auth_user_id);
        } catch (e) {
          console.warn(
            "[registro-propietario] no se pudo borrar auth.user huerfano:",
            e instanceof Error ? e.message : e
          );
        }
      }
    }

    // 1) Email único: ni en propietarios, ni en agentes, ni en usuarios.
    const { rows: emailHits } = await queryWithRetry<{ source: string }>(
      pool,
      `(SELECT 'propietarios' AS source FROM ${t("propietarios")}
          WHERE empresa_id=$1::uuid AND lower(email)=lower($2) LIMIT 1)
       UNION ALL
       (SELECT 'agentes' FROM ${t("agentes")}
          WHERE empresa_id=$1::uuid AND lower(email)=lower($2) LIMIT 1)
       UNION ALL
       (SELECT 'usuarios' FROM ${t("usuarios")}
          WHERE empresa_id=$1::uuid AND lower(email)=lower($2) LIMIT 1)`,
      [ALQUILOYA_EMPRESA_ID, email]
    );
    if (emailHits.length > 0) {
      return NextResponse.json(
        errorResponse("Ese email ya está registrado. Iniciá sesión o usá otro correo."),
        { status: 409 }
      );
    }

    // 2) Teléfono único en propietarios + agentes (comparación por dígitos).
    const { rows: phoneHits } = await queryWithRetry<{ source: string }>(
      pool,
      `(SELECT 'propietarios' AS source FROM ${t("propietarios")}
          WHERE empresa_id=$1::uuid AND regexp_replace(coalesce(telefono,''), '[^0-9+]', '', 'g') = $2 LIMIT 1)
       UNION ALL
       (SELECT 'agentes' FROM ${t("agentes")}
          WHERE empresa_id=$1::uuid AND regexp_replace(coalesce(telefono,''), '[^0-9+]', '', 'g') = $2 LIMIT 1)`,
      [ALQUILOYA_EMPRESA_ID, telefonoNorm]
    );
    if (phoneHits.length > 0) {
      return NextResponse.json(
        errorResponse("Ese teléfono ya está registrado."),
        { status: 409 }
      );
    }

    // 3) Crear auth user + filas en propietarios + usuarios (transaccional para el ERP).
    const supabase = supabaseAdmin;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre,
        fuente: "registro_propietario_directo",
        tipo: "propietario",
      },
    });
    if (createErr || !created.user?.id) {
      const msg = createErr?.message ?? "no se pudo crear la cuenta";
      // Captura específica de "email ya existe" en auth.users.
      if (/already|exists|registered/i.test(msg)) {
        return NextResponse.json(
          errorResponse("Ese email ya tiene una cuenta. Iniciá sesión."),
          { status: 409 }
        );
      }
      return NextResponse.json(errorResponse("No pudimos crear la cuenta: " + msg), { status: 500 });
    }
    const authUserId = created.user.id;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const propResult = await client.query<{ id: string }>(
        `INSERT INTO ${t("propietarios")}
           (empresa_id, nombre, email, telefono, tipo_persona, estado, activo)
         VALUES ($1::uuid, $2, $3, $4, 'fisica', 'verificado', true)
         RETURNING id`,
        [ALQUILOYA_EMPRESA_ID, nombre, email, telefono]
      );
      const propietarioId = propResult.rows[0].id;

      await client.query(
        `INSERT INTO ${t("usuarios")}
           (empresa_id, auth_user_id, email, nombre, rol, propietario_id)
         VALUES ($1::uuid, $2::uuid, $3, $4, 'publicador-propietario', $5::uuid)`,
        [ALQUILOYA_EMPRESA_ID, authUserId, email, nombre, propietarioId]
      );

      // Registro de auditoría en solicitudes_acceso ya como aprobada (best-effort).
      try {
        await client.query(
          `INSERT INTO ${t("solicitudes_acceso")}
             (empresa_id, tipo, nombre, email, telefono, ciudad, estado, resultado_id, revisado_at)
           VALUES ($1::uuid, 'propietario', $2, $3, $4, $5, 'aprobada', $6::uuid, now())`,
          [ALQUILOYA_EMPRESA_ID, nombre, email, telefono, ciudad, propietarioId]
        );
      } catch {
        // no romper el registro si la tabla difiere
      }

      await client.query("COMMIT");

      // Auto-login: signInWithPassword via supabase-ssr SETEA las cookies
      // de sesion en la response, asi el navegador queda autenticado y
      // puede ir directo al panel sin pasar por /portal-agentes/login.
      let autoLogged = false;
      try {
        const userSupa = await createSupabaseServerClient();
        const { error: signInErr } = await userSupa.auth.signInWithPassword({
          email,
          password,
        });
        if (!signInErr) autoLogged = true;
        else {
          console.warn(
            "[registro-propietario] signInWithPassword fallo:",
            signInErr.message
          );
        }
      } catch (e) {
        console.warn(
          "[registro-propietario] excepcion en auto-login:",
          e instanceof Error ? e.message : e
        );
      }

      return NextResponse.json(
        successResponse({
          propietario_id: propietarioId,
          email,
          // Si auto-logueamos, el front redirige directo al panel.
          // Si no, cae a /portal-agentes/login para que entre manualmente.
          portal_url: autoLogged ? "/publico#admin-agent" : "/portal-agentes/login",
          auto_logged: autoLogged,
        })
      );
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      // Compensar: borrar auth user para no dejar cuenta huérfana.
      try {
        await supabase.auth.admin.deleteUser(authUserId);
      } catch {
        // best-effort
      }
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/public/alquiloya/registro-propietario POST]", msg);
    return NextResponse.json(errorResponse("No se pudo registrar: " + msg), { status: 500 });
  }
}
