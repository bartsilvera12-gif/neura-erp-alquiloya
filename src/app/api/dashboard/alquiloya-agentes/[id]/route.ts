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
function i(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : undefined;
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
      `SELECT id, nombre, email, telefono, whatsapp, cargo, bio, foto_url, orden, activo
         FROM ${t("agentes")}
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!rows || rows.length === 0) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-agentes/[id] GET]", err);
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
        `SELECT activo FROM ${t("agentes")} WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
        [ALQUILOYA_EMPRESA_ID, id]
      );
      if (!chk.rows || chk.rows.length === 0) {
        return NextResponse.json({ error: "no encontrado" }, { status: 404 });
      }
      if (chk.rows[0].activo) {
        return NextResponse.json(
          { error: "Para eliminar definitivamente, primero desactivá el agente." },
          { status: 409 }
        );
      }
      try {
        // Cascada manual: antes de borrar el agente, eliminamos las filas
        // vinculadas en alquiloya.usuarios y sus auth.users. Sin esto el
        // email queda "fantasma" y bloquea reaprobar futuras solicitudes
        // con el mismo correo.
        const { rows: linkedUsers } = await queryWithRetry<{ id: string; auth_user_id: string | null }>(
          pool,
          `SELECT id, auth_user_id::text AS auth_user_id
             FROM ${t("usuarios")}
            WHERE empresa_id=$1::uuid AND agente_id=$2::uuid`,
          [ALQUILOYA_EMPRESA_ID, id]
        );
        if (linkedUsers.length > 0) {
          await queryWithRetry(
            pool,
            `DELETE FROM ${t("usuarios")}
              WHERE empresa_id=$1::uuid AND agente_id=$2::uuid`,
            [ALQUILOYA_EMPRESA_ID, id]
          );
          const supabaseAdmin = createServiceRoleClient();
          for (const u of linkedUsers) {
            if (!u.auth_user_id) continue;
            try {
              await supabaseAdmin.auth.admin.deleteUser(u.auth_user_id);
            } catch (cleanupErr) {
              console.warn(
                "[alquiloya-agentes DELETE] no se pudo borrar auth.user",
                u.auth_user_id,
                cleanupErr instanceof Error ? cleanupErr.message : cleanupErr
              );
            }
          }
        }

        const r = await queryWithRetry<{ id: string }>(
          pool,
          `DELETE FROM ${t("agentes")}
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
            { error: "El agente tiene captaciones o propiedades vinculadas y no puede eliminarse definitivamente." },
            { status: 409 }
          );
        }
        throw e;
      }
    }

    // Soft delete: activo=false. Preserva captaciones y propiedades historicas.
    const r = await queryWithRetry<{ id: string }>(
      pool,
      `UPDATE ${t("agentes")} SET activo = false, updated_at = now()
        WHERE empresa_id = $1::uuid AND id = $2::uuid
        RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!r.rows || r.rows.length === 0) {
      return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-agentes/[id] DELETE]", err);
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
    function push(col: string, val: unknown) {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    }
    if (typeof body.nombre === "string") {
      const v = s(body.nombre);
      if (!v) return NextResponse.json({ error: "nombre vacio" }, { status: 400 });
      push("nombre", v);
    }
    if ("email" in body) push("email", s(body.email));
    if ("telefono" in body) push("telefono", s(body.telefono));
    if ("whatsapp" in body) push("whatsapp", s(body.whatsapp));
    if ("cargo" in body) push("cargo", s(body.cargo));
    if ("bio" in body) push("bio", s(body.bio));
    if ("foto_url" in body) push("foto_url", s(body.foto_url));
    // Solo aplicamos columnas opcionales si existen (tolerar instancias sin la migration de perfil).
    const { rows: cols } = await queryWithRetry<{ column_name: string }>(
      pool,
      `SELECT column_name FROM information_schema.columns
         WHERE table_schema='alquiloya' AND table_name='agentes'`,
      []
    );
    const colSet = new Set(cols.map((c) => c.column_name));
    if ("logo_empresa_url" in body && colSet.has("logo_empresa_url")) push("logo_empresa_url", s(body.logo_empresa_url));
    if ("verificado" in body && colSet.has("verificado")) {
      const v = b(body.verificado);
      if (v !== undefined) push("verificado", v);
    }
    if ("nivel" in body && colSet.has("nivel")) push("nivel", s(body.nivel));
    if ("idiomas" in body && colSet.has("idiomas")) push("idiomas", s(body.idiomas));
    if ("tiempo_respuesta" in body && colSet.has("tiempo_respuesta")) push("tiempo_respuesta", s(body.tiempo_respuesta));
    if ("tasa_respuesta" in body && colSet.has("tasa_respuesta")) push("tasa_respuesta", s(body.tasa_respuesta));
    if ("orden" in body) {
      const x = i(body.orden);
      if (x !== undefined) push("orden", x);
    }
    if ("activo" in body) {
      const v = b(body.activo);
      if (v !== undefined) push("activo", v);
    }
    if (sets.length === 0) return NextResponse.json({ error: "sin cambios" }, { status: 400 });

    vals.push(ALQUILOYA_EMPRESA_ID);
    vals.push(id);
    const sql = `UPDATE ${t("agentes")} SET ${sets.join(", ")}, updated_at = now()
                  WHERE empresa_id=$${vals.length - 1}::uuid AND id=$${vals.length}::uuid
                  RETURNING id`;
    const r = await queryWithRetry<{ id: string }>(pool, sql, vals);
    if (!r.rows || r.rows.length === 0) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-agentes/[id] PATCH]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
