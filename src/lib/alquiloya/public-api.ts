import { NextRequest, NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PublicTable =
  | "agentes"
  | "propiedades"
  | "propiedad_fotos"
  | "propiedad_caracteristicas";

function t(table: PublicTable): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

function getPoolOrError(): ReturnType<typeof getChatPostgresPool> {
  return getChatPostgresPool();
}

function parseOptionalPrice(value: string | null, name: string): number | NextResponse | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return NextResponse.json(errorResponse(`${name} invalido`), { status: 400 });
  }
  return n;
}

function validateUuid(id: string, name = "id"): NextResponse | null {
  if (!uuidRe.test(id)) {
    return NextResponse.json(errorResponse(`${name} invalido`), { status: 400 });
  }
  return null;
}

type PropiedadListRow = QueryResultRow & {
  id: string;
  cover: unknown | null;
};

type PropiedadDetailRow = QueryResultRow & {
  id: string;
  fotos: unknown[];
  caracteristicas: unknown[];
  agente: unknown | null;
};

type AgenteListRow = QueryResultRow & {
  id: string;
  propiedades_count: number;
};

type AgenteDetailRow = QueryResultRow & {
  id: string;
  propiedades: unknown[];
};

export async function listPublicPropiedades(request: NextRequest) {
  try {
    const pool = getPoolOrError();
    if (!pool) {
      return NextResponse.json(errorResponse("Pool no disponible."), { status: 500 });
    }

    const sp = request.nextUrl.searchParams;
    const params: unknown[] = [ALQUILOYA_EMPRESA_ID];
    const where = ["p.empresa_id = $1::uuid", "p.activo = true", "p.visible_web = true"];

    for (const [paramName, columnName] of [
      ["ciudad", "ciudad"],
      ["barrio", "barrio"],
      ["tipo", "tipo"],
    ] as const) {
      const value = sp.get(paramName)?.trim();
      if (value) {
        params.push(value);
        where.push(`p.${columnName} = $${params.length}`);
      }
    }

    const precioMin = parseOptionalPrice(sp.get("precio_min"), "precio_min");
    if (precioMin instanceof NextResponse) return precioMin;
    if (precioMin != null) {
      params.push(precioMin);
      where.push(`p.precio >= $${params.length}`);
    }

    const precioMax = parseOptionalPrice(sp.get("precio_max"), "precio_max");
    if (precioMax instanceof NextResponse) return precioMax;
    if (precioMax != null) {
      params.push(precioMax);
      where.push(`p.precio <= $${params.length}`);
    }

    const agenteId = sp.get("agente_id")?.trim();
    if (agenteId) {
      const invalid = validateUuid(agenteId, "agente_id");
      if (invalid) return invalid;
      params.push(agenteId);
      where.push(`p.agente_id = $${params.length}::uuid`);
    }

    const { rows } = await queryWithRetry<PropiedadListRow>(
      pool,
      `
        SELECT
          p.id, p.empresa_id, p.agente_id, p.codigo, p.titulo, p.descripcion,
          p.tipo, p.operacion, p.estado, p.ciudad, p.barrio, p.direccion,
          p.lat::float8 AS lat, p.lng::float8 AS lng, p.precio::float8 AS precio,
          p.moneda, p.dormitorios, p.banos, p.cocheras,
          p.superficie_m2::float8 AS superficie_m2,
          p.terreno_m2::float8 AS terreno_m2,
          (p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now())) AS destacada,
          p.visible_web, p.activo, p.created_at, p.updated_at,
          CASE
            WHEN cover.id IS NULL THEN NULL
            ELSE json_build_object(
              'id', cover.id,
              'url', cover.url,
              'alt', cover.alt,
              'orden', cover.orden,
              'es_portada', cover.es_portada
            )
          END AS cover
        FROM ${t("propiedades")} p
        LEFT JOIN LATERAL (
          SELECT pf.id, pf.url, pf.alt, pf.orden, pf.es_portada
          FROM ${t("propiedad_fotos")} pf
          WHERE pf.empresa_id = p.empresa_id
            AND pf.propiedad_id = p.id
            AND pf.activo = true
          ORDER BY pf.es_portada DESC, pf.orden ASC, pf.created_at ASC, pf.id ASC
          LIMIT 1
        ) cover ON true
        WHERE ${where.join(" AND ")}
        ORDER BY (p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now())) DESC,
                 p.created_at DESC, p.titulo ASC
      `,
      params
    );

    return NextResponse.json(successResponse({ propiedades: rows ?? [] }));
  } catch (err) {
    console.error("[api/public/alquiloya/propiedades]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar las propiedades."), { status: 500 });
  }
}

export async function getPublicPropiedad(id: string) {
  try {
    const invalid = validateUuid(id);
    if (invalid) return invalid;

    const pool = getPoolOrError();
    if (!pool) {
      return NextResponse.json(errorResponse("Pool no disponible."), { status: 500 });
    }

    const { rows } = await queryWithRetry<PropiedadDetailRow>(
      pool,
      `
        SELECT
          p.id, p.empresa_id, p.agente_id, p.codigo, p.titulo, p.descripcion,
          p.tipo, p.operacion, p.estado, p.ciudad, p.barrio, p.direccion,
          p.lat::float8 AS lat, p.lng::float8 AS lng, p.precio::float8 AS precio,
          p.moneda, p.dormitorios, p.banos, p.cocheras,
          p.superficie_m2::float8 AS superficie_m2,
          p.terreno_m2::float8 AS terreno_m2,
          (p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now())) AS destacada,
          p.visible_web, p.activo, p.created_at, p.updated_at,
          CASE
            WHEN a.id IS NULL THEN NULL
            ELSE json_build_object(
              'id', a.id,
              'nombre', a.nombre,
              'email', a.email,
              'telefono', a.telefono,
              'whatsapp', a.whatsapp,
              'foto_url', a.foto_url,
              'cargo', a.cargo,
              'bio', a.bio
            )
          END AS agente,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', pf.id,
                'url', pf.url,
                'alt', pf.alt,
                'orden', pf.orden,
                'es_portada', pf.es_portada
              )
              ORDER BY pf.es_portada DESC, pf.orden ASC, pf.created_at ASC, pf.id ASC
            )
            FROM ${t("propiedad_fotos")} pf
            WHERE pf.empresa_id = p.empresa_id
              AND pf.propiedad_id = p.id
              AND pf.activo = true
          ), '[]'::json) AS fotos,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', pc.id,
                'nombre', pc.nombre,
                'valor', pc.valor,
                'icono', pc.icono,
                'orden', pc.orden
              )
              ORDER BY pc.orden ASC, pc.nombre ASC, pc.id ASC
            )
            FROM ${t("propiedad_caracteristicas")} pc
            WHERE pc.empresa_id = p.empresa_id
              AND pc.propiedad_id = p.id
              AND pc.activo = true
          ), '[]'::json) AS caracteristicas
        FROM ${t("propiedades")} p
        LEFT JOIN ${t("agentes")} a
          ON a.id = p.agente_id
         AND a.empresa_id = p.empresa_id
         AND a.activo = true
        WHERE p.empresa_id = $1::uuid
          AND p.id = $2::uuid
          AND p.activo = true
          AND p.visible_web = true
        LIMIT 1
      `,
      [ALQUILOYA_EMPRESA_ID, id]
    );

    const propiedad = rows[0] ?? null;
    if (!propiedad) {
      return NextResponse.json(errorResponse("Propiedad no encontrada"), { status: 404 });
    }
    return NextResponse.json(successResponse({ propiedad }));
  } catch (err) {
    console.error("[api/public/alquiloya/propiedades/[id]]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo cargar la propiedad."), { status: 500 });
  }
}

export async function listPublicAgentes() {
  try {
    const pool = getPoolOrError();
    if (!pool) {
      return NextResponse.json(errorResponse("Pool no disponible."), { status: 500 });
    }

    const { rows } = await queryWithRetry<AgenteListRow>(
      pool,
      `
        SELECT
          a.id, a.empresa_id, a.nombre, a.email, a.telefono, a.whatsapp,
          a.foto_url, a.cargo, a.bio, a.orden, a.activo, a.created_at, a.updated_at,
          (
            SELECT count(*)::int
            FROM ${t("propiedades")} p
            WHERE p.empresa_id = a.empresa_id
              AND p.agente_id = a.id
              AND p.activo = true
              AND p.visible_web = true
          ) AS propiedades_count
        FROM ${t("agentes")} a
        WHERE a.empresa_id = $1::uuid
          AND a.activo = true
        ORDER BY a.orden ASC, a.nombre ASC
      `,
      [ALQUILOYA_EMPRESA_ID]
    );

    return NextResponse.json(successResponse({ agentes: rows ?? [] }));
  } catch (err) {
    console.error("[api/public/alquiloya/agentes]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los agentes."), { status: 500 });
  }
}

export async function getPublicAgente(id: string) {
  try {
    const invalid = validateUuid(id);
    if (invalid) return invalid;

    const pool = getPoolOrError();
    if (!pool) {
      return NextResponse.json(errorResponse("Pool no disponible."), { status: 500 });
    }

    const { rows } = await queryWithRetry<AgenteDetailRow>(
      pool,
      `
        SELECT
          a.id, a.empresa_id, a.nombre, a.email, a.telefono, a.whatsapp,
          a.foto_url, a.cargo, a.bio, a.orden, a.activo, a.created_at, a.updated_at,
          COALESCE(a.verificado, false) AS verificado,
          a.nivel, a.idiomas, a.tiempo_respuesta, a.tasa_respuesta,
          (SELECT count(*)::int FROM "alquiloya"."propiedades" pc
             WHERE pc.empresa_id = a.empresa_id AND pc.agente_id = a.id
               AND pc.estado IN ('alquilado','vendido','cerrado','cerrada','finalizado')
          ) AS cierres_count,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', z.id, 'ciudad', z.ciudad, 'barrio', z.barrio, 'orden', z.orden
            ) ORDER BY z.orden ASC, z.created_at ASC)
            FROM "alquiloya"."agente_zonas" z
            WHERE z.empresa_id = a.empresa_id AND z.agente_id = a.id
          ), '[]'::json) AS zonas,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', tp.id, 'zona', tp.zona, 'titulo', tp.titulo, 'body', tp.body, 'orden', tp.orden
            ) ORDER BY tp.orden ASC, tp.created_at ASC)
            FROM "alquiloya"."agente_tips" tp
            WHERE tp.empresa_id = a.empresa_id AND tp.agente_id = a.id AND tp.activo = true
          ), '[]'::json) AS tips,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', r.id, 'autor_nombre', r.autor_nombre, 'rol', r.rol,
              'stars', r.stars, 'body', r.body, 'created_at', r.created_at
            ) ORDER BY r.created_at DESC)
            FROM "alquiloya"."agente_resenas" r
            WHERE r.empresa_id = a.empresa_id AND r.agente_id = a.id AND r.estado = 'aprobada'
          ), '[]'::json) AS resenas,
          (SELECT count(*)::int FROM "alquiloya"."agente_resenas" rc
             WHERE rc.empresa_id = a.empresa_id AND rc.agente_id = a.id AND rc.estado='aprobada'
          ) AS resenas_count,
          (SELECT COALESCE(round(avg(stars)::numeric, 1), 0)::float8
             FROM "alquiloya"."agente_resenas" ra
             WHERE ra.empresa_id = a.empresa_id AND ra.agente_id = a.id AND ra.estado='aprobada'
          ) AS rating,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', p.id,
                'empresa_id', p.empresa_id,
                'agente_id', p.agente_id,
                'codigo', p.codigo,
                'titulo', p.titulo,
                'descripcion', p.descripcion,
                'tipo', p.tipo,
                'operacion', p.operacion,
                'estado', p.estado,
                'ciudad', p.ciudad,
                'barrio', p.barrio,
                'direccion', p.direccion,
                'precio', p.precio::float8,
                'moneda', p.moneda,
                'dormitorios', p.dormitorios,
                'banos', p.banos,
                'cocheras', p.cocheras,
                'superficie_m2', p.superficie_m2::float8,
                'destacada', (p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now())),
                'cover', CASE
                  WHEN cover.id IS NULL THEN NULL
                  ELSE json_build_object(
                    'id', cover.id,
                    'url', cover.url,
                    'alt', cover.alt,
                    'orden', cover.orden,
                    'es_portada', cover.es_portada
                  )
                END
              )
              ORDER BY (p.destacada AND (p.destacada_hasta IS NULL OR p.destacada_hasta > now())) DESC,
                 p.created_at DESC, p.titulo ASC
            )
            FROM ${t("propiedades")} p
            LEFT JOIN LATERAL (
              SELECT pf.id, pf.url, pf.alt, pf.orden, pf.es_portada
              FROM ${t("propiedad_fotos")} pf
              WHERE pf.empresa_id = p.empresa_id
                AND pf.propiedad_id = p.id
                AND pf.activo = true
              ORDER BY pf.es_portada DESC, pf.orden ASC, pf.created_at ASC, pf.id ASC
              LIMIT 1
            ) cover ON true
            WHERE p.empresa_id = a.empresa_id
              AND p.agente_id = a.id
              AND p.activo = true
              AND p.visible_web = true
          ), '[]'::json) AS propiedades
        FROM ${t("agentes")} a
        WHERE a.empresa_id = $1::uuid
          AND a.id = $2::uuid
          AND a.activo = true
        LIMIT 1
      `,
      [ALQUILOYA_EMPRESA_ID, id]
    );

    const agente = rows[0] ?? null;
    if (!agente) {
      return NextResponse.json(errorResponse("Agente no encontrado"), { status: 404 });
    }
    return NextResponse.json(successResponse({ agente }));
  } catch (err) {
    console.error("[api/public/alquiloya/agentes/[id]]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo cargar el agente."), { status: 500 });
  }
}
