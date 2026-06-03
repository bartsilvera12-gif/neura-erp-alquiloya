import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { listPublicPropiedades } from "@/lib/alquiloya/public-api";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

export async function GET(request: NextRequest) {
  return listPublicPropiedades(request);
}

// ─── POST público — "Publicar gratis" desde la web ──────────────────────────
// Crea propiedad + propietario + fotos + características.
// La propiedad queda inactiva / no visible_web hasta que el admin la revise.
const TIPOS_OK = new Set([
  "departamento", "casa", "duplex", "duplex_ph", "terreno",
  "local_comercial", "oficina", "deposito", "casa_independiente",
  "salon_comercial", "alquiler_temporal",
]);
const OPERACIONES_OK = new Set(["alquiler", "venta"]);
const MAX_FOTOS = 20;
const MAX_CARAC = 30;

// Extrae la URL real cuando el campo viene como HTML embed (postimg, imgbb, etc.)
function sanitizeImageUrl(v: unknown, max = 1024): string | null {
  const raw = s(v, max);
  if (!raw) return null;
  if (!/[<>]/.test(raw)) return raw;
  const img = raw.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (img?.[1]) return img[1].trim().slice(0, max);
  const href = raw.match(/<a[^>]+href\s*=\s*["']([^"']+)["']/i);
  if (href?.[1]) return href[1].trim().slice(0, max);
  const url = raw.match(/https?:\/\/[^\s"'<>]+/i);
  return url ? url[0].slice(0, max) : raw;
}
function s(v: unknown, max = 1024): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}
function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : null;
}
function i(v: unknown): number | null {
  const x = n(v);
  return x == null ? null : Math.trunc(x);
}
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function normalizeTipo(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (t === "depto") return "departamento";
  if (t === "salon") return "salon_comercial";
  if (t === "temporal") return "alquiler_temporal";
  if (t === "local") return "local_comercial";
  return TIPOS_OK.has(t) ? t : null;
}
function normalizeOperacion(raw: string | null): string {
  if (!raw) return "alquiler";
  const o = raw.trim().toLowerCase();
  if (o === "venta") return "venta";
  // 'permanente', 'temporal', 'alquiler', cualquier otro → alquiler
  return "alquiler";
}

type CaracIn = { nombre?: string; valor?: string | null; icono?: string | null };
type FotoIn = { url?: string; alt?: string | null; es_portada?: boolean | null };
type Body = {
  titulo?: string; tipo?: string; operacion?: string; descripcion?: string;
  ciudad?: string; barrio?: string; direccion?: string;
  precio?: number | string; moneda?: string;
  dormitorios?: number | string; banos?: number | string; cocheras?: number | string;
  superficie_m2?: number | string; terreno_m2?: number | string;
  fotos?: FotoIn[];
  caracteristicas?: CaracIn[];
  propietario_nombre?: string;
  propietario_email?: string;
  propietario_telefono?: string;
  propietario_documento?: string;
  plan_publicacion_id?: string | null;
  notas_propietario?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

    // Sanitización + validaciones
    const titulo = s(body.titulo, 240);
    const tipo = normalizeTipo(s(body.tipo, 60));
    const operacion = normalizeOperacion(s(body.operacion, 30));
    const ciudad = s(body.ciudad, 120);
    const precio = n(body.precio);
    const propNombre = s(body.propietario_nombre, 240);
    const propEmail = s(body.propietario_email, 240);
    const propTelefono = s(body.propietario_telefono, 60);

    if (!titulo) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
    if (!tipo) return NextResponse.json({ error: "tipo invalido" }, { status: 400 });
    if (!OPERACIONES_OK.has(operacion)) return NextResponse.json({ error: "operacion invalida" }, { status: 400 });
    if (!ciudad) return NextResponse.json({ error: "ciudad requerida" }, { status: 400 });
    if (operacion === "alquiler" || operacion === "venta") {
      if (precio == null || precio < 0) {
        return NextResponse.json({ error: "precio requerido" }, { status: 400 });
      }
    }
    if (!propNombre) return NextResponse.json({ error: "Nombre del propietario requerido" }, { status: 400 });
    if (!propEmail && !propTelefono) {
      return NextResponse.json({ error: "Necesitamos email o teléfono del propietario" }, { status: 400 });
    }
    if (propEmail && !isEmail(propEmail)) {
      return NextResponse.json({ error: "email invalido" }, { status: 400 });
    }

    const fotos = Array.isArray(body.fotos) ? body.fotos.slice(0, MAX_FOTOS) : [];
    const carac = Array.isArray(body.caracteristicas) ? body.caracteristicas.slice(0, MAX_CARAC) : [];

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Upsert propietario por (empresa_id, lower(email)) o (empresa_id, telefono)
      let propietarioId: string | null = null;
      if (propEmail) {
        const r = await client.query<{ id: string }>(
          `SELECT id FROM "alquiloya"."propietarios"
            WHERE empresa_id=$1::uuid AND lower(email)=lower($2) LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, propEmail]
        );
        if (r.rows[0]) propietarioId = r.rows[0].id;
      }
      if (!propietarioId && propTelefono) {
        const r = await client.query<{ id: string }>(
          `SELECT id FROM "alquiloya"."propietarios"
            WHERE empresa_id=$1::uuid AND telefono=$2 LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, propTelefono]
        );
        if (r.rows[0]) propietarioId = r.rows[0].id;
      }

      // plan_publicacion_id puede llegar como UUID directo o como tier slug (ej. "gratuito-owner").
      // Si no es UUID, resolvemos contra planes_publicacion por tier; si tampoco existe, queda null.
      const planRaw = s(body.plan_publicacion_id, 80);
      let planId: string | null = null;
      if (planRaw) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planRaw)) {
          planId = planRaw;
        } else {
          const r = await client.query<{ id: string }>(
            `SELECT id FROM "alquiloya"."planes_publicacion"
              WHERE empresa_id = $1::uuid AND tier = $2 AND activo = true
              LIMIT 1`,
            [ALQUILOYA_EMPRESA_ID, planRaw]
          );
          planId = r.rows[0]?.id ?? null;
        }
      }
      const notas = s(body.notas_propietario, 1000);

      if (!propietarioId) {
        const r = await client.query<{ id: string }>(
          `INSERT INTO "alquiloya"."propietarios" (
             empresa_id, nombre, email, telefono, documento,
             estado, activo, plan_publicacion_id, observaciones
           )
           VALUES ($1::uuid, $2, $3, $4, $5, 'pendiente', true, $6, $7)
           RETURNING id`,
          [
            ALQUILOYA_EMPRESA_ID,
            propNombre,
            propEmail,
            propTelefono,
            s(body.propietario_documento, 60),
            planId,
            notas,
          ]
        );
        propietarioId = r.rows[0].id;
      } else if (planId || notas) {
        // Actualizar plan / observaciones si llegaron y la fila ya existía
        await client.query(
          `UPDATE "alquiloya"."propietarios"
              SET plan_publicacion_id = COALESCE($1, plan_publicacion_id),
                  observaciones       = COALESCE($2, observaciones),
                  updated_at = now()
            WHERE id = $3::uuid`,
          [planId, notas, propietarioId]
        );
      }

      // 2. Insertar propiedad — siempre como NO publicada/inactiva
      const ins = await client.query<{ id: string; codigo: string | null }>(
        `INSERT INTO "alquiloya"."propiedades" (
           empresa_id, propietario_id, agente_id, codigo, titulo, descripcion,
           tipo, operacion, estado, ciudad, barrio, direccion,
           precio, moneda, dormitorios, banos, cocheras,
           superficie_m2, terreno_m2,
           destacada, visible_web, activo
         )
         VALUES (
           $1::uuid, $2::uuid, NULL,
           'AY-PUB-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || floor(random()*1000)::int,
           $3, $4, $5, $6,
           'inactiva',
           $7, $8, $9,
           $10, COALESCE($11,'PYG'), $12, $13, $14,
           $15, $16,
           false, false, false
         )
         RETURNING id, codigo`,
        [
          ALQUILOYA_EMPRESA_ID,
          propietarioId,
          titulo,
          s(body.descripcion, 4000),
          tipo,
          operacion,
          ciudad,
          s(body.barrio, 120),
          s(body.direccion, 240),
          precio,
          s(body.moneda, 10),
          i(body.dormitorios),
          i(body.banos),
          i(body.cocheras),
          n(body.superficie_m2),
          n(body.terreno_m2),
        ]
      );
      const propId = ins.rows[0].id;

      // 3. Fotos
      let orden = 0;
      for (const f of fotos) {
        const url = sanitizeImageUrl(f?.url, 1024);
        if (!url) continue;
        await client.query(
          `INSERT INTO "alquiloya"."propiedad_fotos"
             (empresa_id, propiedad_id, url, alt, orden, es_portada, activo)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
          [
            ALQUILOYA_EMPRESA_ID, propId, url,
            s(f?.alt, 240),
            orden,
            orden === 0 ? true : !!f?.es_portada,
          ]
        );
        orden++;
      }

      // 4. Características
      let cOrden = 0;
      for (const c of carac) {
        const nombre = s(c?.nombre, 120);
        if (!nombre) continue;
        await client.query(
          `INSERT INTO "alquiloya"."propiedad_caracteristicas"
             (empresa_id, propiedad_id, nombre, valor, icono, orden, activo)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true)`,
          [
            ALQUILOYA_EMPRESA_ID, propId, nombre,
            s(c?.valor, 240),
            s(c?.icono, 60),
            cOrden,
          ]
        );
        cOrden++;
      }

      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        propiedad_id: propId,
        codigo: ins.rows[0].codigo,
        propietario_id: propietarioId,
        estado: "inactiva",
        visible_web: false,
        activo: false,
        message: "Tu propiedad fue enviada para revisión. El equipo de AlquiloYa la revisará antes de publicarla.",
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api public alquiloya/propiedades POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
