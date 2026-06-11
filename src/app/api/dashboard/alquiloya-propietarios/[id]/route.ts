import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";

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
function b(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    const { rows } = await queryWithRetry(
      pool,
      `SELECT id, nombre, email, telefono, documento, tipo_persona,
              estado, activo, plan_publicacion_id, observaciones
         FROM ${t("propietarios")}
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!rows || rows.length === 0) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propietarios/[id] GET]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const url = new URL(request.url);
    const hard = url.searchParams.get("hard") === "true";

    if (hard) {
      const chk = await queryWithRetry<{ activo: boolean }>(
        pool,
        `SELECT activo FROM ${t("propietarios")} WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
        [ALQUILOYA_EMPRESA_ID, id]
      );
      if (!chk.rows || chk.rows.length === 0) {
        return NextResponse.json({ error: "no encontrado" }, { status: 404 });
      }
      if (chk.rows[0].activo) {
        return NextResponse.json(
          { error: "Para eliminar definitivamente, primero desactivá el propietario." },
          { status: 409 }
        );
      }
      try {
        // Cascada manual: antes de borrar el propietario, eliminamos las filas
        // vinculadas en alquiloya.usuarios y sus auth.users. Sin esto el email
        // queda "fantasma" y bloquea reintentos de alta directa con el mismo
        // correo. Mismo patron que el DELETE de agentes.
        const { rows: linkedUsers } = await queryWithRetry<{ id: string; auth_user_id: string | null }>(
          pool,
          `SELECT id, auth_user_id::text AS auth_user_id
             FROM ${t("usuarios")}
            WHERE empresa_id=$1::uuid AND propietario_id=$2::uuid`,
          [ALQUILOYA_EMPRESA_ID, id]
        );
        if (linkedUsers.length > 0) {
          await queryWithRetry(
            pool,
            `DELETE FROM ${t("usuarios")}
              WHERE empresa_id=$1::uuid AND propietario_id=$2::uuid`,
            [ALQUILOYA_EMPRESA_ID, id]
          );
          const supabaseAdmin = createServiceRoleClient();
          for (const u of linkedUsers) {
            if (!u.auth_user_id) continue;
            try {
              await supabaseAdmin.auth.admin.deleteUser(u.auth_user_id);
            } catch (cleanupErr) {
              console.warn(
                "[alquiloya-propietarios DELETE] no se pudo borrar auth.user",
                u.auth_user_id,
                cleanupErr instanceof Error ? cleanupErr.message : cleanupErr
              );
            }
          }
        }

        const r = await queryWithRetry<{ id: string }>(
          pool,
          `DELETE FROM ${t("propietarios")}
             WHERE empresa_id=$1::uuid AND id=$2::uuid
             RETURNING id`,
          [ALQUILOYA_EMPRESA_ID, id]
        );
        if (!r.rows || r.rows.length === 0) {
          return NextResponse.json({ error: "no encontrado" }, { status: 404 });
        }
        return NextResponse.json({ success: true, id: r.rows[0].id, hard: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/foreign key|violates|23503/i.test(msg)) {
          return NextResponse.json(
            { error: "El propietario tiene propiedades vinculadas y no puede eliminarse definitivamente." },
            { status: 409 }
          );
        }
        throw e;
      }
    }

    const r = await queryWithRetry<{ id: string }>(
      pool,
      `UPDATE ${t("propietarios")} SET activo = false, updated_at = now()
        WHERE empresa_id = $1::uuid AND id = $2::uuid
        RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!r.rows || r.rows.length === 0) {
      return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propietarios/[id] DELETE]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const sets: string[] = [];
    const vals: unknown[] = [];
    function push(col: string, val: unknown, cast = "") {
      vals.push(val);
      sets.push(`${col} = $${vals.length}${cast}`);
    }

    if (typeof body.nombre === "string") {
      const v = s(body.nombre);
      if (!v) return NextResponse.json({ error: "nombre vacio" }, { status: 400 });
      push("nombre", v);
    }
    if ("email" in body) push("email", s(body.email));
    if ("telefono" in body) push("telefono", s(body.telefono));
    if ("documento" in body) push("documento", s(body.documento));
    if ("tipo_persona" in body) push("tipo_persona", s(body.tipo_persona));
    if ("estado" in body) push("estado", s(body.estado));
    if ("observaciones" in body) push("observaciones", s(body.observaciones));
    if ("activo" in body) {
      const v = b(body.activo);
      if (v !== undefined) push("activo", v);
    }
    if ("plan_publicacion_id" in body) {
      const v = s(body.plan_publicacion_id);
      if (v && !uuidRe.test(v)) return NextResponse.json({ error: "plan_publicacion_id invalido" }, { status: 400 });
      push("plan_publicacion_id", v, "::uuid");
    }

    if (sets.length === 0) return NextResponse.json({ error: "sin cambios" }, { status: 400 });

    vals.push(ALQUILOYA_EMPRESA_ID);
    vals.push(id);
    const sql = `UPDATE ${t("propietarios")} SET ${sets.join(", ")}
                  WHERE empresa_id=$${vals.length - 1}::uuid AND id=$${vals.length}::uuid
                  RETURNING id`;
    const r = await queryWithRetry<{ id: string }>(pool, sql, vals);
    if (!r.rows || r.rows.length === 0) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propietarios/[id] PATCH]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
