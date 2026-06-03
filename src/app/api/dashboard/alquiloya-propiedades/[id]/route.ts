import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// Extrae la URL real cuando el campo viene como HTML embed (postimg, imgbb, etc.)
function sanitizeImageUrl(v: unknown): string | null {
  const raw = s(v);
  if (!raw) return null;
  if (!/[<>]/.test(raw)) return raw;
  const img = raw.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (img?.[1]) return img[1].trim();
  const href = raw.match(/<a[^>]+href\s*=\s*["']([^"']+)["']/i);
  if (href?.[1]) return href[1].trim();
  const url = raw.match(/https?:\/\/[^\s"'<>]+/i);
  return url ? url[0] : raw;
}
function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function i(v: unknown): number | null {
  const x = n(v);
  return x == null ? null : Math.trunc(x);
}
function b(v: unknown, def: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return def;
}

type PatchBody = {
  titulo?: string;
  tipo?: string;
  operacion?: string;
  estado?: string;
  ciudad?: string;
  barrio?: string;
  direccion?: string;
  descripcion?: string;
  precio?: number | string | null;
  moneda?: string;
  dormitorios?: number | string | null;
  banos?: number | string | null;
  cocheras?: number | string | null;
  superficie_m2?: number | string | null;
  terreno_m2?: number | string | null;
  codigo?: string | null;
  agente_id?: string | null;
  activo?: boolean;
  visible_web?: boolean;
  destacada?: boolean;
  fotos?: Array<{ url: string; alt?: string | null; es_portada?: boolean | null }>;
  caracteristicas?: Array<{ nombre: string; valor?: string | null; icono?: string | null }>;
};

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as PatchBody;

    const titulo = s(body.titulo);
    const tipo = s(body.tipo);
    if (!titulo) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
    if (!tipo) return NextResponse.json({ error: "tipo requerido" }, { status: 400 });

    const agenteId = body.agente_id == null || body.agente_id === "" ? null : s(body.agente_id);
    if (agenteId && !uuidRe.test(agenteId)) {
      return NextResponse.json({ error: "agente_id invalido" }, { status: 400 });
    }

    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");

      // Lock & verify ownership
      const existing = await client.query(
        `SELECT id FROM ${t("propiedades")} WHERE id = $1::uuid AND empresa_id = $2::uuid FOR UPDATE`,
        [id, ALQUILOYA_EMPRESA_ID]
      );
      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
      }

      await client.query(
        `UPDATE ${t("propiedades")} SET
           agente_id = $1::uuid,
           codigo = $2,
           titulo = $3,
           descripcion = $4,
           tipo = $5,
           operacion = COALESCE($6, operacion),
           estado = COALESCE($7, estado),
           ciudad = $8,
           barrio = $9,
           direccion = $10,
           precio = $11,
           moneda = COALESCE($12, moneda),
           dormitorios = $13,
           banos = $14,
           cocheras = $15,
           superficie_m2 = $16,
           terreno_m2 = $17,
           destacada = $18,
           visible_web = $19,
           activo = $20,
           updated_at = now()
         WHERE id = $21::uuid AND empresa_id = $22::uuid`,
        [
          agenteId,
          s(body.codigo),
          titulo,
          s(body.descripcion),
          tipo,
          s(body.operacion),
          s(body.estado),
          s(body.ciudad),
          s(body.barrio),
          s(body.direccion),
          n(body.precio),
          s(body.moneda),
          i(body.dormitorios),
          i(body.banos),
          i(body.cocheras),
          n(body.superficie_m2),
          n(body.terreno_m2),
          b(body.destacada, false),
          b(body.visible_web, true),
          b(body.activo, true),
          id,
          ALQUILOYA_EMPRESA_ID,
        ]
      );

      // Replace fotos (only if provided in body)
      if (Array.isArray(body.fotos)) {
        await client.query(
          `DELETE FROM ${t("propiedad_fotos")} WHERE empresa_id = $1::uuid AND propiedad_id = $2::uuid`,
          [ALQUILOYA_EMPRESA_ID, id]
        );
        let orden = 0;
        const anyPortada = body.fotos.some((f) => !!f?.es_portada);
        for (const f of body.fotos) {
          const url = sanitizeImageUrl(f?.url);
          if (!url) continue;
          const portada = anyPortada ? !!f?.es_portada : orden === 0;
          await client.query(
            `INSERT INTO ${t("propiedad_fotos")}
               (empresa_id, propiedad_id, url, alt, orden, es_portada, activo)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
            [ALQUILOYA_EMPRESA_ID, id, url, s(f?.alt), orden, portada]
          );
          orden++;
        }
      }

      // Replace caracteristicas (only if provided)
      if (Array.isArray(body.caracteristicas)) {
        await client.query(
          `DELETE FROM ${t("propiedad_caracteristicas")} WHERE empresa_id = $1::uuid AND propiedad_id = $2::uuid`,
          [ALQUILOYA_EMPRESA_ID, id]
        );
        let cOrden = 0;
        for (const c of body.caracteristicas) {
          const nombre = s(c?.nombre);
          if (!nombre) continue;
          await client.query(
            `INSERT INTO ${t("propiedad_caracteristicas")}
               (empresa_id, propiedad_id, nombre, valor, icono, orden, activo)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
            [ALQUILOYA_EMPRESA_ID, id, nombre, s(c?.valor), s(c?.icono), cOrden]
          );
          cOrden++;
        }
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true, id });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propiedades/[id] PATCH]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
