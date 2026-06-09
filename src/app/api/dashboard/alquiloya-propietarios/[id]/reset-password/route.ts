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

    // 2) Buscar usuarios.propietario_id = id para reutilizar auth_user_id.
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

    // Caso B — no hay fila en usuarios: creamos auth.user + usuarios.
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
    if (createErr) {
      return NextResponse.json(
        { error: `No se pudo crear la cuenta: ${createErr.message}` },
        { status: 500 }
      );
    }
    if (!created.user?.id) {
      return NextResponse.json({ error: "no se pudo crear el auth.user" }, { status: 500 });
    }

    await queryWithRetry(
      pool,
      `INSERT INTO ${t("usuarios")}
         (empresa_id, auth_user_id, email, nombre, rol, propietario_id)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'publicador-propietario', $5::uuid)`,
      [ALQUILOYA_EMPRESA_ID, created.user.id, prop.email, prop.nombre, id]
    );

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
