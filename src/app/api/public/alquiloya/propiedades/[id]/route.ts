import { NextRequest, NextResponse } from "next/server";
import { getPublicPropiedad } from "@/lib/alquiloya/public-api";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";

type RouteCtx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bootstrap idempotente del estado 'eliminada' para el soft-delete.
// Espejo de la migracion 20260705120000_alquiloya_propiedades_estado_eliminada
// — asegura que prod no quede esperando a que alguien corra la migracion
// manualmente para que el DELETE saque las propiedades del contador de
// pendientes. Corre UNA vez por proceso.
let estadoEliminadaReady = false;
async function ensureEstadoEliminada(pool: import("pg").Pool): Promise<void> {
  if (estadoEliminadaReady) return;
  try {
    await pool.query(`
      DO $$
      BEGIN
        PERFORM 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'alquiloya'
           AND t.relname = 'propiedades'
           AND c.conname = 'propiedades_estado_check';
        IF FOUND THEN
          EXECUTE 'ALTER TABLE alquiloya.propiedades DROP CONSTRAINT propiedades_estado_check';
        END IF;
      END $$;
      ALTER TABLE alquiloya.propiedades
        ADD CONSTRAINT propiedades_estado_check
        CHECK (
          estado IS NULL OR estado IN (
            'disponible','reservado','alquilado','vendido','pausada',
            'inactiva','rechazada','cerrado','cerrada','finalizado','eliminada'
          )
        );
      UPDATE alquiloya.propiedades
         SET estado = 'eliminada', updated_at = now()
       WHERE activo = false
         AND visible_web = false
         AND estado = 'inactiva'
         AND updated_at > created_at + interval '5 seconds';
    `);
    estadoEliminadaReady = true;
  } catch (e) {
    console.error("[ensureEstadoEliminada] bootstrap fail", e);
    // No throw: si falla, el UPDATE de DELETE de abajo igual va a marcar
    // visible_web=false / activo=false y el row quedara contado. El usuario
    // puede reintentar despues de que se corra la migracion manualmente.
  }
}

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  return getPublicPropiedad(id);
}

// ── PATCH público — edicion por el dueño desde el panel agente/propietario ──
//
// El usuario logueado puede editar SU propia propiedad (match por
// propietario_id o agente_id contra alquiloya.usuarios). Reemplaza fotos y
// caracteristicas (delete + insert) para que el wizard pueda enviar la
// lista completa sin tener que diffear en el cliente.
const TIPOS_OK = new Set([
  "departamento", "casa", "duplex", "duplex_ph", "terreno",
  "local_comercial", "oficina", "deposito", "casa_independiente",
  "salon_comercial", "alquiler_temporal",
]);
const OPERACIONES_OK = new Set(["alquiler", "venta"]);
// Estados que el dueno puede setear desde el panel. "aprobada"/"rechazada"
// quedan reservados al admin global. "alquilada"/"reservada" sacan la propiedad
// del listado publico (visible_web=false) pero NO la borran.
const ESTADOS_USUARIO_OK = new Set(["pausada", "activa", "alquilada", "reservada"]);

function s(v: unknown, max = 1024): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}
function n(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : undefined;
}
function i(v: unknown): number | null | undefined {
  const x = n(v);
  return x === undefined ? undefined : x === null ? null : Math.trunc(x);
}
function coord(v: unknown, kind: "lat" | "lng"): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const x = Number(v);
  if (!Number.isFinite(x)) return undefined;
  const limit = kind === "lat" ? 90 : 180;
  return Math.abs(x) <= limit ? x : undefined;
}
function sanitizeImageUrl(v: unknown, max = 2048): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (/^data:image\//i.test(trimmed)) return trimmed.slice(0, 10 * 1024 * 1024);
  if (/[<>]/.test(trimmed)) {
    const img = trimmed.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (img?.[1]) return img[1].trim().slice(0, max);
    const url = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
    return url ? url[0].slice(0, max) : trimmed.slice(0, max);
  }
  return trimmed.slice(0, max);
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    const authUser = await getAuthUserForApiRoute(request);
    if (!authUser?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const supabase = createServiceRoleClient();
    const usuarioErp = await resolveUsuarioErpFromAuthUser(supabase, authUser);
    if (!usuarioErp || usuarioErp.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no autorizado" }, { status: 403 });
    }
    const { data: uExt } = await supabase
      .from("usuarios")
      .select("agente_id, propietario_id")
      .eq("id", usuarioErp.id)
      .limit(1)
      .maybeSingle();
    const userAgenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
    const userPropietarioId = (uExt as { propietario_id?: string | null } | null)?.propietario_id ?? null;
    if (!userAgenteId && !userPropietarioId) {
      return NextResponse.json({ error: "Sin perfil de publicador" }, { status: 403 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // Ownership check.
    const own = await pool.query<{ propietario_id: string | null; agente_id: string | null }>(
      `SELECT propietario_id::text AS propietario_id, agente_id::text AS agente_id
         FROM "alquiloya"."propiedades"
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (own.rows.length === 0) {
      return NextResponse.json({ error: "no encontrada" }, { status: 404 });
    }
    const owns =
      (userPropietarioId && own.rows[0].propietario_id === userPropietarioId) ||
      (userAgenteId && own.rows[0].agente_id === userAgenteId);
    if (!owns) {
      return NextResponse.json({ error: "No podes editar esta propiedad" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Construimos UPDATE dinamico solo con los campos que vengan en el body.
    const sets: string[] = [];
    const vals: unknown[] = [];
    function push(col: string, val: unknown, cast = "") {
      vals.push(val);
      sets.push(`${col} = $${vals.length}${cast}`);
    }
    const titulo = s(body.titulo, 240);
    if (titulo !== undefined) {
      if (!titulo) return NextResponse.json({ error: "Titulo requerido" }, { status: 400 });
      push("titulo", titulo);
    }
    const descripcion = s(body.descripcion, 4000);
    if (descripcion !== undefined) push("descripcion", descripcion);
    if (body.tipo !== undefined) {
      const t = s(body.tipo, 40);
      if (t && !TIPOS_OK.has(t)) return NextResponse.json({ error: "Tipo invalido" }, { status: 400 });
      push("tipo", t);
    }
    if (body.operacion !== undefined) {
      const op = s(body.operacion, 20);
      if (op && !OPERACIONES_OK.has(op)) return NextResponse.json({ error: "Operacion invalida" }, { status: 400 });
      push("operacion", op);
    }
    const ciudad = s(body.ciudad, 80);
    if (ciudad !== undefined) {
      if (!ciudad) return NextResponse.json({ error: "Ciudad requerida" }, { status: 400 });
      push("ciudad", ciudad);
    }
    const barrio = s(body.barrio, 120);
    if (barrio !== undefined) push("barrio", barrio);
    const direccion = s(body.direccion, 240);
    if (direccion !== undefined) push("direccion", direccion);
    const moneda = s(body.moneda, 10);
    if (moneda !== undefined) push("moneda", moneda || "PYG");
    const precio = n(body.precio);
    if (precio !== undefined) {
      if (precio === null || precio <= 0) return NextResponse.json({ error: "Precio invalido" }, { status: 400 });
      push("precio", precio);
    }
    const dormitorios = i(body.dormitorios);
    if (dormitorios !== undefined) push("dormitorios", dormitorios);
    const banos = i(body.banos);
    if (banos !== undefined) push("banos", banos);
    const cocheras = i(body.cocheras);
    if (cocheras !== undefined) push("cocheras", cocheras);
    const superficie = n(body.superficie_m2);
    if (superficie !== undefined) push("superficie_m2", superficie);
    const terreno = n(body.terreno_m2);
    if (terreno !== undefined) push("terreno_m2", terreno);
    const lat = coord(body.lat, "lat");
    if (lat !== undefined) push("lat", lat);
    const lng = coord(body.lng, "lng");
    if (lng !== undefined) push("lng", lng);
    const pubDias = i(body.publicacion_dias);
    if (pubDias !== undefined) push("publicacion_dias", pubDias);

    // Cambios de estado y visibilidad desde el panel del dueno.
    if (body.estado !== undefined) {
      const est = s(body.estado, 30);
      if (!est || !ESTADOS_USUARIO_OK.has(est)) {
        return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
      }
      push("estado", est);
      // Reglas de visibilidad asociadas: activa => visible y activo. Las demas
      // (pausada/alquilada/reservada) salen del listado publico pero siguen
      // existiendo para que el dueno las vea y pueda reactivar.
      if (est === "activa") {
        push("visible_web", true);
        push("activo", true);
      } else {
        push("visible_web", false);
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (sets.length > 0) {
        vals.push(ALQUILOYA_EMPRESA_ID);
        vals.push(id);
        await client.query(
          `UPDATE "alquiloya"."propiedades"
             SET ${sets.join(", ")}, updated_at = now()
            WHERE empresa_id=$${vals.length - 1}::uuid AND id=$${vals.length}::uuid`,
          vals
        );
      }

      // Fotos: si vienen en el body, reemplazo total (delete + insert). Si no
      // vienen, no las tocamos.
      if (Array.isArray(body.fotos)) {
        await client.query(
          `DELETE FROM "alquiloya"."propiedad_fotos" WHERE empresa_id=$1::uuid AND propiedad_id=$2::uuid`,
          [ALQUILOYA_EMPRESA_ID, id]
        );
        let orden = 0;
        for (const f of body.fotos as { url?: unknown; alt?: unknown; es_portada?: unknown }[]) {
          const url = sanitizeImageUrl(f?.url, 1024);
          if (!url) continue;
          await client.query(
            `INSERT INTO "alquiloya"."propiedad_fotos"
               (empresa_id, propiedad_id, url, alt, orden, es_portada, activo)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
            [
              ALQUILOYA_EMPRESA_ID, id, url,
              s(f?.alt, 240) ?? null,
              orden,
              orden === 0 ? true : !!f?.es_portada,
            ]
          );
          orden++;
        }
      }

      if (Array.isArray(body.caracteristicas)) {
        await client.query(
          `DELETE FROM "alquiloya"."propiedad_caracteristicas" WHERE empresa_id=$1::uuid AND propiedad_id=$2::uuid`,
          [ALQUILOYA_EMPRESA_ID, id]
        );
        let co = 0;
        for (const c of body.caracteristicas as { nombre?: unknown; valor?: unknown; icono?: unknown }[]) {
          const nombre = s(c?.nombre, 120);
          if (!nombre) continue;
          await client.query(
            `INSERT INTO "alquiloya"."propiedad_caracteristicas"
               (empresa_id, propiedad_id, nombre, valor, icono, orden, activo)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
            [
              ALQUILOYA_EMPRESA_ID, id, nombre,
              s(c?.valor, 240) ?? null,
              s(c?.icono, 60) ?? null,
              co,
            ]
          );
          co++;
        }
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true, id, message: "Cambios guardados." });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api/public/alquiloya/propiedades/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

// ── DELETE — soft-delete del dueno ──────────────────────────────────────────
// No borramos la fila: marcamos activo=false + visible_web=false. Asi queda
// auditable y reversible desde el admin global si el usuario se arrepiente.
export async function DELETE(request: Request, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }
    const authUser = await getAuthUserForApiRoute(request);
    if (!authUser?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const supabase = createServiceRoleClient();
    const usuarioErp = await resolveUsuarioErpFromAuthUser(supabase, authUser);
    if (!usuarioErp || usuarioErp.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no autorizado" }, { status: 403 });
    }
    const { data: uExt } = await supabase
      .from("usuarios")
      .select("agente_id, propietario_id")
      .eq("id", usuarioErp.id)
      .limit(1)
      .maybeSingle();
    const userAgenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
    const userPropietarioId = (uExt as { propietario_id?: string | null } | null)?.propietario_id ?? null;
    if (!userAgenteId && !userPropietarioId) {
      return NextResponse.json({ error: "Sin perfil de publicador" }, { status: 403 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const own = await pool.query<{ propietario_id: string | null; agente_id: string | null }>(
      `SELECT propietario_id::text AS propietario_id, agente_id::text AS agente_id
         FROM "alquiloya"."propiedades"
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (own.rows.length === 0) {
      return NextResponse.json({ error: "no encontrada" }, { status: 404 });
    }
    const owns =
      (userPropietarioId && own.rows[0].propietario_id === userPropietarioId) ||
      (userAgenteId && own.rows[0].agente_id === userAgenteId);
    if (!owns) {
      return NextResponse.json({ error: "No podes borrar esta propiedad" }, { status: 403 });
    }

    // Aseguramos que la DB acepte estado='eliminada' (bootstrap) ANTES de
    // intentar setearlo. Si el bootstrap falla, el UPDATE de abajo cae al
    // SET sin estado para no romper el flujo.
    await ensureEstadoEliminada(pool);
    try {
      await pool.query(
        `UPDATE "alquiloya"."propiedades"
            SET activo = false, visible_web = false, estado = 'eliminada', updated_at = now()
          WHERE empresa_id=$1::uuid AND id=$2::uuid`,
        [ALQUILOYA_EMPRESA_ID, id]
      );
    } catch {
      // Fallback (CHECK constraint todavia sin 'eliminada'): minimo dejamos
      // la propiedad inactiva y fuera de la web. Reintentar el bootstrap
      // luego termina de limpiarla cuando alguien borre la proxima.
      await pool.query(
        `UPDATE "alquiloya"."propiedades"
            SET activo = false, visible_web = false, updated_at = now()
          WHERE empresa_id=$1::uuid AND id=$2::uuid`,
        [ALQUILOYA_EMPRESA_ID, id]
      );
    }
    return NextResponse.json({ success: true, id, message: "Propiedad eliminada." });
  } catch (err) {
    console.error("[api/public/alquiloya/propiedades/[id] DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
