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
  | "propiedad_caracteristicas"
  | "propietarios"
  | "planes_publicacion"
  | "agente_posts";

function t(table: PublicTable): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

function getPoolOrError(): ReturnType<typeof getChatPostgresPool> {
  return getChatPostgresPool();
}

// Cache module-level: bootstrap idempotente de alquiloya.propiedades.publicacion_dias.
// La migration 20260703120000 puede no estar aplicada — si la columna falta,
// el filtro de "plan gratis vencido" usaria un identificador inexistente y
// la query revienta. Se corre una vez por cold start.
let publicacionDiasReady = false;
async function ensurePublicacionDiasColumn(): Promise<void> {
  if (publicacionDiasReady) return;
  const pool = getChatPostgresPool();
  if (!pool) return;
  try {
    // Bootstrap idempotente de todas las columnas opcionales que usa la SELECT
    // publica. Si la migration aun no corrio (deploy frio en una DB vieja),
    // CREATE IF NOT EXISTS las agrega y evita 500 al levantar el catalogo.
    await pool.query(
      `ALTER TABLE alquiloya.propiedades
         ADD COLUMN IF NOT EXISTS publicacion_dias integer`
    );
    await pool.query(
      `ALTER TABLE alquiloya.propiedades
         ADD COLUMN IF NOT EXISTS video_url text`
    );
    await pool.query(
      `ALTER TABLE alquiloya.propiedades
         ADD COLUMN IF NOT EXISTS vistas_count integer NOT NULL DEFAULT 0`
    );
    await pool.query(
      `ALTER TABLE alquiloya.propiedades
         ADD COLUMN IF NOT EXISTS ultima_vista_at timestamptz`
    );
    publicacionDiasReady = true;
  } catch (e) {
    console.warn(
      "[alquiloya/public-api] bootstrap columnas opcionales:",
      e instanceof Error ? e.message : e
    );
  }
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

    await ensurePublicacionDiasColumn();

    const sp = request.nextUrl.searchParams;
    const params: unknown[] = [ALQUILOYA_EMPRESA_ID];
    const where = [
      "p.empresa_id = $1::uuid",
      "p.activo = true",
      "p.visible_web = true",
      // Plan gratis vence a los N dias desde created_at, donde N viene de
      // propiedades.publicacion_dias (NULL = 30 por defecto). El admin puede
      // editar ese plazo por propiedad desde el ERP. Si la propiedad esta
      // ligada a un propietario con plan gratis y ya pasaron N dias, no la
      // mostramos al publico — sigue en el ERP para que el cliente pague el
      // plan y la reactive.
      `NOT (
         p.created_at < now() - (COALESCE(p.publicacion_dias, 30) || ' days')::interval
         AND EXISTS (
           SELECT 1 FROM ${t("propietarios")} pr
           LEFT JOIN ${t("planes_publicacion")} pp ON pp.id = pr.plan_publicacion_id
           WHERE pr.id = p.propietario_id
             AND (pp.billing = 'gratis' OR pp.tier ILIKE 'gratuito%')
         )
       )`,
    ];

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
          COALESCE(p.verificada, false) AS verificada,
          p.visible_web, p.activo, p.created_at, p.updated_at,
          COALESCE(p.video_url, NULL) AS video_url,
          COALESCE(p.vistas_count, 0)::int AS vistas_count,
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

export async function getPublicPropiedad(id: string, opts?: { includeAnyState?: boolean }) {
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
          COALESCE(p.verificada, false) AS verificada,
          p.visible_web, p.activo, p.created_at, p.updated_at,
          COALESCE(p.video_url, NULL) AS video_url,
          COALESCE(p.vistas_count, 0)::int AS vistas_count,
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
          -- Contacto efectivo para el boton de WhatsApp en la ficha publica:
          -- si hay agente usamos su whatsapp/telefono; si es publicacion de
          -- propietario directo, usamos el telefono del propietario. Asi el
          -- boton "Consultar por WhatsApp" siempre lleva al numero correcto.
          json_build_object(
            'tipo', CASE WHEN a.id IS NOT NULL THEN 'agente' ELSE 'propietario' END,
            'nombre', COALESCE(a.nombre, pr.nombre),
            -- Para el contacto publico de la ficha preferimos el telefono_contacto
            -- del propietario (numero PUBLICO que el dueño puso en el form de
            -- publicar), y si no esta seteado caemos al telefono personal.
            'telefono', COALESCE(a.telefono, pr.telefono_contacto, pr.telefono),
            'whatsapp', COALESCE(a.whatsapp, a.telefono, pr.telefono_contacto, pr.telefono)
          ) AS contacto,
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
        LEFT JOIN ${t("propietarios")} pr
          ON pr.id = p.propietario_id
         AND pr.empresa_id = p.empresa_id
        WHERE p.empresa_id = $1::uuid
          AND p.id = $2::uuid
          ${opts?.includeAnyState ? "" : "AND p.activo = true AND p.visible_web = true"}
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
          a.foto_url, a.logo_empresa_url,
          a.cargo, a.bio, a.orden, a.activo, a.created_at, a.updated_at,
          (
            SELECT count(*)::int
            FROM ${t("propiedades")} p
            WHERE p.empresa_id = a.empresa_id
              AND p.agente_id = a.id
              AND p.activo = true
              AND p.visible_web = true
          ) AS propiedades_count,
          (
            SELECT count(*)::int
            FROM ${t("agente_posts")} pp
            WHERE pp.empresa_id = a.empresa_id
              AND pp.agente_id = a.id
              AND pp.publicado = true
          ) AS posts_count
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

    await ensurePublicacionDiasColumn();

    const { rows } = await queryWithRetry<AgenteDetailRow>(
      pool,
      `
        SELECT
          a.id, a.empresa_id, a.nombre, a.email, a.telefono, a.whatsapp,
          a.foto_url, a.logo_empresa_url,
          a.cargo, a.bio, a.orden, a.activo, a.created_at, a.updated_at,
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
                'verificada', COALESCE(p.verificada, false),
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
              -- En el perfil del agente alcanza con activo=true (no exigimos
              -- visible_web). Asi si el admin activo la propiedad pero
              -- olvido el toggle visible_web, igual aparece en su portfolio.
              -- El listado publico /propiedades sigue exigiendo ambos.
              AND p.activo = true
              AND COALESCE(p.estado, 'disponible') NOT IN ('rechazada', 'pausada')
              -- Plan gratis vencido (mas de COALESCE(publicacion_dias, 30)
              -- dias desde created_at): se oculta del perfil publico hasta
              -- que pague un plan. publicacion_dias es editable por propiedad
              -- desde el ERP.
              AND NOT (
                p.created_at < now() - (COALESCE(p.publicacion_dias, 30) || ' days')::interval
                AND EXISTS (
                  SELECT 1 FROM ${t("propietarios")} pr
                  LEFT JOIN ${t("planes_publicacion")} pp ON pp.id = pr.plan_publicacion_id
                  WHERE pr.id = p.propietario_id
                    AND (pp.billing = 'gratis' OR pp.tier ILIKE 'gratuito%')
                )
              )
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
