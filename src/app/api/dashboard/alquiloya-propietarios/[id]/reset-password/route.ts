import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

// Cache module-level: una vez parcheado el schema (o confirmado que ya esta),
// no volvemos a chequear hasta el proximo cold start.
let usuariosPropietarioIdSchemaReady = false;

// Espejo idempotente de supabase/migrations/20260627120000_alquiloya_usuarios_propietario_id.sql
// Se ejecuta on-demand si la columna falta en produccion. Sin esto, la query
// SELECT propietario_id FROM usuarios fallaba con SQLSTATE 42703.
const BOOTSTRAP_USUARIOS_PROPIETARIO_ID_SQL = `
ALTER TABLE alquiloya.usuarios
  ADD COLUMN IF NOT EXISTS propietario_id uuid;

CREATE INDEX IF NOT EXISTS usuarios_propietario_id_idx
  ON alquiloya.usuarios (empresa_id, propietario_id)
  WHERE propietario_id IS NOT NULL;
`;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/dashboard/alquiloya-propietarios/[id]/reset-password
 *
 * Resetea (o crea si no existe) la cuenta del portal para un propietario.
 *
 * Caso A — el propietario ya tiene una fila en alquiloya.usuarios:
 *   1) Genera una nueva contraseña temporal.
 *   2) Llama supabase.auth.admin.updateUserById(auth_user_id, { password }).
 *
 * Caso B — el propietario NO tiene fila en usuarios (fue creado a mano desde
 * el ERP, sin pasar por aprobacion):
 *   1) Requiere que el propietario tenga email cargado.
 *   2) Crea auth.users + alquiloya.usuarios (rol 'publicador-propietario',
 *      propietario_id = id), igual que el flujo de aprobacion.
 *
 * Devuelve { email, tempPassword } en ambos casos. El frontend lo muestra
 * en un dialogo para que el admin lo copie y se lo pase al cliente.
 */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // 1) Buscar el propietario para obtener email + nombre.
    const { rows: propRows } = await queryWithRetry<{
      id: string;
      nombre: string;
      email: string | null;
    }>(
      pool,
      `SELECT id, nombre, email FROM ${t("propietarios")}
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    const prop = propRows[0];
    if (!prop) return NextResponse.json({ error: "propietario no encontrado" }, { status: 404 });
    if (!prop.email) {
      return NextResponse.json(
        { error: "El propietario no tiene email cargado. Agregalo y volve a intentar." },
        { status: 400 }
      );
    }

    // 2) Bootstrap on-demand de alquiloya.usuarios.propietario_id si falta.
    // La migracion 20260627120000_alquiloya_usuarios_propietario_id.sql no
    // estaba aplicada en produccion — sin esto, la query siguiente fallaba
    // con SQLSTATE 42703 "column propietario_id does not exist".
    if (!usuariosPropietarioIdSchemaReady) {
      try {
        await queryWithRetry(pool, BOOTSTRAP_USUARIOS_PROPIETARIO_ID_SQL, []);
        usuariosPropietarioIdSchemaReady = true;
      } catch (bootErr) {
        const code = (bootErr as { code?: string })?.code ?? "";
        console.error(
          "[propietarios/reset-password] bootstrap fail",
          "code=" + code,
          bootErr instanceof Error ? bootErr.message : bootErr
        );
        return NextResponse.json(
          {
            error:
              "No pudimos preparar el schema de usuarios. Avisa al admin." +
              (code ? ` (codigo ${code})` : ""),
          },
          { status: 503 }
        );
      }
    }

    // 3) Buscar usuarios.propietario_id = id para reutilizar auth_user_id.
    const { rows: usuarioRows } = await queryWithRetry<{
      id: string;
      auth_user_id: string;
    }>(
      pool,
      `SELECT id, auth_user_id FROM ${t("usuarios")}
        WHERE empresa_id=$1::uuid AND propietario_id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );

    // Password temporal — mismo formato que el flujo de aprobacion (12 chars + !9).
    const tempPassword =
      crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x").slice(0, 12) + "!9";

    const supabase = createServiceRoleClient();

    if (usuarioRows[0]) {
      // Caso A — ya hay cuenta: solo actualizamos el password en auth.users.
      const { error: updErr } = await supabase.auth.admin.updateUserById(
        usuarioRows[0].auth_user_id,
        { password: tempPassword }
      );
      if (updErr) {
        return NextResponse.json(
          { error: `No se pudo resetear la contraseña: ${updErr.message}` },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        email: prop.email,
        tempPassword,
        created: false,
      });
    }

    // Caso B — no hay fila en usuarios para este propietario. Tres
    // sub-escenarios posibles:
    //   B1) Email nuevo en auth.users → createUser + INSERT usuarios.
    //   B2) auth.users ya existe pero sin fila en usuarios (huerfana de
    //       creacion previa) → updatePassword + INSERT usuarios.
    //   B3) auth.users existe Y hay una fila en usuarios para ese
    //       auth_user_id pero sin propietario_id seteado (ej. creada como
    //       agente o sin vinculo) → updatePassword + UPDATE usuarios para
    //       linkear propietario_id.
    let authUserId: string | null = null;
    let usuarioRowId: string | null = null;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: prop.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        nombre: prop.nombre,
        fuente: "propietario_manual",
        tipo: "propietario",
      },
    });

    if (created?.user?.id && !createErr) {
      // B1 — usuario nuevo.
      authUserId = created.user.id;
    } else if (createErr && /already\s+(been\s+)?registered/i.test(createErr.message)) {
      // B2/B3 — el email ya existe en auth.users. Buscamos su id y
      // reseteamos la contraseña en lugar de crearlo de nuevo.
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) {
        return NextResponse.json(
          { error: `No se pudo buscar el usuario existente: ${listErr.message}` },
          { status: 500 }
        );
      }
      const existing = list.users.find(
        (u) => (u.email ?? "").toLowerCase() === prop.email!.toLowerCase()
      );
      if (!existing?.id) {
        return NextResponse.json(
          {
            error:
              "El email ya esta registrado pero no pudimos resolverlo. Pedi soporte al admin.",
          },
          { status: 500 }
        );
      }
      authUserId = existing.id;
      const { error: updErr } = await supabase.auth.admin.updateUserById(authUserId, {
        password: tempPassword,
      });
      if (updErr) {
        return NextResponse.json(
          { error: `No se pudo resetear la contraseña: ${updErr.message}` },
          { status: 500 }
        );
      }
      // Buscamos si hay una fila en alquiloya.usuarios para ese auth_user_id
      // (escenario B3): si la hay y NO tiene propietario_id, la linkeamos.
      const { rows: byAuth } = await queryWithRetry<{
        id: string;
        propietario_id: string | null;
      }>(
        pool,
        `SELECT id, propietario_id FROM ${t("usuarios")}
          WHERE empresa_id=$1::uuid AND auth_user_id=$2::uuid LIMIT 1`,
        [ALQUILOYA_EMPRESA_ID, authUserId]
      );
      if (byAuth[0]) {
        usuarioRowId = byAuth[0].id;
        if (!byAuth[0].propietario_id) {
          // No tocamos updated_at: en algunas instancias de produccion la
          // columna no existe (la migracion que la agrega no esta corrida)
          // y el UPDATE fallaria con SQLSTATE 42703.
          await queryWithRetry(
            pool,
            `UPDATE ${t("usuarios")}
                SET propietario_id = $1::uuid
              WHERE id = $2::uuid`,
            [id, usuarioRowId]
          );
        } else if (byAuth[0].propietario_id !== id) {
          return NextResponse.json(
            {
              error:
                "Ese email ya esta vinculado a OTRO propietario. Cambia el email del propietario antes de generar acceso.",
            },
            { status: 409 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: `No se pudo crear la cuenta: ${createErr?.message ?? "error desconocido"}` },
        { status: 500 }
      );
    }

    // Si todavia no insertamos en alquiloya.usuarios (B1 y B2), lo hacemos.
    if (!usuarioRowId) {
      await queryWithRetry(
        pool,
        `INSERT INTO ${t("usuarios")}
           (empresa_id, auth_user_id, email, nombre, rol, propietario_id)
         VALUES ($1::uuid, $2::uuid, $3, $4, 'publicador-propietario', $5::uuid)`,
        [ALQUILOYA_EMPRESA_ID, authUserId, prop.email, prop.nombre, id]
      );
    }

    return NextResponse.json({
      success: true,
      email: prop.email,
      tempPassword,
      created: true,
    });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propietarios/[id]/reset-password POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
