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

type PostBody = {
  titulo?: string;
  tipo?: string;
  operacion?: string;
  estado?: string;
  ciudad?: string;
  barrio?: string;
  direccion?: string;
  descripcion?: string;
  precio?: number | string;
  moneda?: string;
  dormitorios?: number | string;
  banos?: number | string;
  cocheras?: number | string;
  superficie_m2?: number | string;
  terreno_m2?: number | string;
  codigo?: string;
  agente_id?: string | null;
  activo?: boolean;
  visible_web?: boolean;
  destacada?: boolean;
  fotos?: Array<{ url: string; alt?: string | null; es_portada?: boolean | null }>;
  caracteristicas?: Array<{ nombre: string; valor?: string | null; icono?: string | null }>;
};

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const pool = getChatPostgresPool();
    if (!pool) {
      return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const titulo = s(body.titulo);
    const tipo = s(body.tipo);
    if (!titulo) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
    if (!tipo) return NextResponse.json({ error: "tipo requerido" }, { status: 400 });

    const agenteId = s(body.agente_id);
    if (agenteId && !uuidRe.test(agenteId)) {
      return NextResponse.json({ error: "agente_id invalido" }, { status: 400 });
    }

    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");

      const ins = await client.query(
        `INSERT INTO ${t("propiedades")} (
           empresa_id, agente_id, codigo, titulo, descripcion,
           tipo, operacion, estado, ciudad, barrio, direccion,
           precio, moneda, dormitorios, banos, cocheras,
           superficie_m2, terreno_m2,
           destacada, visible_web, activo
         )
         VALUES (
           $1::uuid, $2::uuid, $3, $4, $5,
           $6, COALESCE($7, 'alquiler'), COALESCE($8, 'disponible'), $9, $10, $11,
           $12, COALESCE($13, 'PYG'), $14, $15, $16,
           $17, $18,
           $19, $20, $21
         )
         RETURNING id`,
        [
          ALQUILOYA_EMPRESA_ID,
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
        ]
      );
      const propId = ins.rows[0].id as string;

      // Fotos (URLs)
      const fotos = Array.isArray(body.fotos) ? body.fotos : [];
      let orden = 0;
      for (const f of fotos) {
        const url = sanitizeImageUrl(f?.url);
        if (!url) continue;
        await client.query(
          `INSERT INTO ${t("propiedad_fotos")} (empresa_id, propiedad_id, url, alt, orden, es_portada, activo)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
          [ALQUILOYA_EMPRESA_ID, propId, url, s(f?.alt), orden, !!f?.es_portada || orden === 0]
        );
        orden++;
      }

      // Características
      const cars = Array.isArray(body.caracteristicas) ? body.caracteristicas : [];
      let cOrden = 0;
      for (const c of cars) {
        const nombre = s(c?.nombre);
        if (!nombre) continue;
        await client.query(
          `INSERT INTO ${t("propiedad_caracteristicas")} (empresa_id, propiedad_id, nombre, valor, icono, orden, activo)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
          [ALQUILOYA_EMPRESA_ID, propId, nombre, s(c?.valor), s(c?.icono), cOrden]
        );
        cOrden++;
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true, id: propId });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propiedades POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
