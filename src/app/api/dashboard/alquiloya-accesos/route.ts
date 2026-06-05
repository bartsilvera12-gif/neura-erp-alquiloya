import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length > 0 ? x : null;
}

/** Genera contraseña temporal robusta (no se guarda en DB). */
function generateTempPassword(): string {
  // 24 chars con base64url + suffix de un símbolo para satisfacer policies.
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const b64 = Buffer.from(bytes).toString("base64").replace(/\+/g, "A").replace(/\//g, "B").replace(/=/g, "");
  return `${b64.slice(0, 20)}#9z`;
}

type PostBody = {
  tipo?: "agente" | "propietario" | "referido_partner";
  id?: string;
  email?: string;
  // Para referido_partner el admin puede definir la contraseña.
  // Si no se envía, se genera una temporal como en los otros flujos.
  password?: string;
};

/**
 * Busca un usuario en Supabase Auth por email recorriendo páginas de listUsers.
 * Se usa solo cuando createUser falla por email duplicado.
 * El tipo de `admin` se acota con `unknown`/cast local para evitar fricción
 * con los genéricos de `SupabaseClient` (que cambian entre versiones).
 */
async function findAuthUserByEmail(
  admin: {
    listUsers: (opts: { page: number; perPage: number }) => Promise<{
      data: { users: Array<{ id: string; email: string | null }> } | null;
      error: { message: string } | null;
    }>;
  },
  email: string
): Promise<{ id: string; email: string | null } | null> {
  const lower = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[alquiloya-accesos] listUsers:", error.message);
      return null;
    }
    const users = data?.users ?? [];
    if (users.length === 0) return null;
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === lower);
    if (hit) return { id: hit.id, email: hit.email ?? null };
    if (users.length < 1000) return null;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getAuthUserForApiRoute(request);
    if (!sessionUser?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const tipo = body.tipo;
    const targetId = s(body.id);
    const emailOverride = s(body.email);
    const passwordOverride = s(body.password);

    if (tipo !== "agente" && tipo !== "propietario" && tipo !== "referido_partner") {
      return NextResponse.json({ error: "tipo invalido" }, { status: 400 });
    }
    if (!targetId || !uuidRe.test(targetId)) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }
    if (passwordOverride && passwordOverride.length < 8) {
      return NextResponse.json({ error: "password debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase admin no configurado" }, { status: 500 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // 1. Resolver email + nombre del target
    let email: string | null = emailOverride;
    let nombre: string | null = null;

    if (tipo === "agente") {
      const r = await queryWithRetry<{ email: string | null; nombre: string | null }>(
        pool,
        `SELECT email, nombre FROM ${t("agentes")}
          WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
        [ALQUILOYA_EMPRESA_ID, targetId]
      );
      if (!r.rows || r.rows.length === 0) {
        return NextResponse.json({ error: "agente no encontrado" }, { status: 404 });
      }
      email = email ?? r.rows[0].email;
      nombre = r.rows[0].nombre;
    } else if (tipo === "propietario") {
      const r = await queryWithRetry<{ email: string | null; nombre: string | null; usuario_id: string | null }>(
        pool,
        `SELECT email, nombre, usuario_id FROM ${t("propietarios")}
          WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
        [ALQUILOYA_EMPRESA_ID, targetId]
      );
      if (!r.rows || r.rows.length === 0) {
        return NextResponse.json({ error: "propietario no encontrado" }, { status: 404 });
      }
      email = email ?? r.rows[0].email;
      nombre = r.rows[0].nombre;
    } else {
      // tipo === 'referido_partner'
      const r = await queryWithRetry<{ email: string | null; nombre: string | null; usuario_id: string | null }>(
        pool,
        `SELECT email, nombre, usuario_id FROM ${t("referral_partners")}
          WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
        [ALQUILOYA_EMPRESA_ID, targetId]
      );
      if (!r.rows || r.rows.length === 0) {
        return NextResponse.json({ error: "referido no encontrado" }, { status: 404 });
      }
      email = email ?? r.rows[0].email;
      nombre = r.rows[0].nombre;
    }

    if (!email) {
      return NextResponse.json({ error: "email requerido (no hay email en el registro)" }, { status: 400 });
    }

    // 2. Crear (o reutilizar) usuario en Supabase Auth.
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Si el admin define password (caso típico de referido_partner) la usamos
    // tal cual; si no, generamos una temporal. NUNCA se guarda en DB.
    const passwordToUse = passwordOverride ?? generateTempPassword();
    const passwordWasAdminProvided = !!passwordOverride;
    let authUserId: string | null = null;
    let createdNewAuthUser = false;

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: passwordToUse,
      email_confirm: true,
      user_metadata: { source: "alquiloya_portal", tipo, target_id: targetId },
    });

    if (created.error) {
      const msg = (created.error.message ?? "").toLowerCase();
      const isDup =
        msg.includes("already") ||
        msg.includes("exists") ||
        msg.includes("registered") ||
        msg.includes("duplicate");
      if (isDup) {
        // El tipo del cast es deliberadamente acotado al subset que usamos.
        const adminApi = supabaseAdmin.auth.admin as unknown as Parameters<typeof findAuthUserByEmail>[0];
        const existing = await findAuthUserByEmail(adminApi, email);
        if (!existing) {
          return NextResponse.json(
            { error: "El email ya existe en Auth pero no se pudo recuperar" },
            { status: 500 }
          );
        }
        authUserId = existing.id;

        // CRITICO: si el admin definio password (caso referido_partner), lo
        // aplicamos al auth.user existente. Sin esto el referido no puede
        // entrar con la contrasenia recien definida -> "Credenciales
        // incorrectas". Solo lo hacemos cuando el admin definio password
        // explicitamente, para no pisar contrasenias de agentes/propietarios
        // que ya estaban usando su cuenta.
        if (passwordWasAdminProvided) {
          const upd = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            password: passwordToUse,
            email_confirm: true,
          });
          if (upd.error) {
            return NextResponse.json(
              { error: `No se pudo actualizar la contrasenia: ${upd.error.message}` },
              { status: 500 }
            );
          }
        }
      } else {
        return NextResponse.json({ error: created.error.message }, { status: 500 });
      }
    } else {
      authUserId = created.data.user?.id ?? null;
      createdNewAuthUser = !!authUserId;
    }

    if (!authUserId) {
      return NextResponse.json({ error: "No se pudo obtener auth_user_id" }, { status: 500 });
    }

    // 3. Upsert en alquiloya.usuarios.
    const rol =
      tipo === "agente"
        ? "agente_publicador"
        : tipo === "propietario"
        ? "propietario_publicador"
        : "referido_partner";

    // ¿Hay ya una fila en usuarios para este auth_user_id?
    const existsByAuth = await queryWithRetry<{ id: string }>(
      pool,
      `SELECT id FROM ${t("usuarios")} WHERE auth_user_id = $1::uuid LIMIT 1`,
      [authUserId]
    );

    let usuarioErpId: string;
    if (existsByAuth.rows && existsByAuth.rows.length > 0) {
      usuarioErpId = existsByAuth.rows[0].id;
      // Actualizamos sólo lo necesario; no pisamos datos personales si ya existían.
      if (tipo === "agente") {
        await queryWithRetry(
          pool,
          `UPDATE ${t("usuarios")}
              SET empresa_id = $1::uuid,
                  rol = COALESCE(rol, $2),
                  agente_id = COALESCE(agente_id, $3::uuid),
                  activo = true,
                  estado = COALESCE(estado, 'activo')
            WHERE id = $4::uuid`,
          [ALQUILOYA_EMPRESA_ID, rol, targetId, usuarioErpId]
        );
      } else {
        await queryWithRetry(
          pool,
          `UPDATE ${t("usuarios")}
              SET empresa_id = $1::uuid,
                  rol = COALESCE(rol, $2),
                  activo = true,
                  estado = COALESCE(estado, 'activo')
            WHERE id = $3::uuid`,
          [ALQUILOYA_EMPRESA_ID, rol, usuarioErpId]
        );
      }
    } else {
      const insertCols = [
        "email",
        "nombre",
        "rol",
        "empresa_id",
        "auth_user_id",
        "activo",
        "estado",
      ];
      const insertVals: unknown[] = [email, nombre, rol, ALQUILOYA_EMPRESA_ID, authUserId, true, "activo"];
      if (tipo === "agente") {
        insertCols.push("agente_id");
        insertVals.push(targetId);
      }
      const placeholders = insertVals.map((_, i) => {
        const col = insertCols[i];
        if (col === "empresa_id" || col === "auth_user_id" || col === "agente_id") return `$${i + 1}::uuid`;
        return `$${i + 1}`;
      });
      const r = await queryWithRetry<{ id: string }>(
        pool,
        `INSERT INTO ${t("usuarios")} (${insertCols.join(", ")})
           VALUES (${placeholders.join(", ")})
           RETURNING id`,
        insertVals
      );
      usuarioErpId = r.rows[0].id;
    }

    // 4. Vincular usuario_id en la tabla del target (propietario / referral_partner).
    if (tipo === "propietario") {
      await queryWithRetry(
        pool,
        `UPDATE ${t("propietarios")}
            SET usuario_id = $1::uuid, updated_at = now()
          WHERE empresa_id = $2::uuid AND id = $3::uuid
            AND (usuario_id IS NULL OR usuario_id <> $1::uuid)`,
        [usuarioErpId, ALQUILOYA_EMPRESA_ID, targetId]
      );
    } else if (tipo === "referido_partner") {
      await queryWithRetry(
        pool,
        `UPDATE ${t("referral_partners")}
            SET usuario_id = $1::uuid, updated_at = now()
          WHERE empresa_id = $2::uuid AND id = $3::uuid
            AND (usuario_id IS NULL OR usuario_id <> $1::uuid)`,
        [usuarioErpId, ALQUILOYA_EMPRESA_ID, targetId]
      );
    }

    return NextResponse.json({
      success: true,
      email,
      rol,
      // Si el admin definió el password, no lo devolvemos (lo conoce).
      // Si lo generamos, lo devolvemos UNA vez para mostrar en modal.
      temporary_password: createdNewAuthUser && !passwordWasAdminProvided ? passwordToUse : null,
      password_was_admin_provided: passwordWasAdminProvided,
      reused_auth_user: !createdNewAuthUser,
    });
  } catch (err) {
    console.error(
      "[api/dashboard/alquiloya-accesos POST]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
