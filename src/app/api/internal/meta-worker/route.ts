// POST /api/internal/meta-worker
// Protegido por INTERNAL_WORKER_SECRET (header x-worker-secret).
// Se invoca desde Coolify Scheduled Task cada 1 minuto.
//
// Flujo por invocacion:
//   1) Recuperar registros atascados en 'processing' > 10 min -> vuelven a pending
//   2) Tomar hasta N filas pending elegibles con FOR UPDATE SKIP LOCKED
//   3) Por cada una: publicar. Si OK -> published. Si falla:
//      - transient -> schedule retry con backoff exp
//      - auth      -> failed + marcar conexion como 'expired'
//      - permanent -> failed
//   4) Timeout total del worker: 55s (para no chocar con el timeout del cron).

import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { decryptMetaSecret } from "@/lib/meta/security";
import { sanitizeError } from "@/lib/meta/owner";
import { generateCaption } from "@/lib/meta/caption-generator";
import { resolveMediaUrl } from "@/lib/meta/media-uploader";
import { publishFacebookPhoto, publishInstagramImage } from "@/lib/meta/publisher";
import { GraphError } from "@/lib/meta/graph-client";
import type { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

// Cuantos jobs procesa por invocacion. Con cron cada 1 min y ~10s/job,
// 5 alcanza para no saturar y dejar margen para reintentos.
const BATCH_SIZE = 5;
// Cuanto tiempo puede quedar en 'processing' antes de rescatarlo (worker
// que murio a mitad de camino).
const STUCK_MINUTES = 10;
// Backoff: intento -> minutos hasta el proximo retry
const BACKOFF_MIN: Record<number, number> = {
  0: 1, 1: 5, 2: 30, 3: 120, 4: 720,
};
const MAX_ATTEMPTS = 5;

type JobRow = {
  id: string;
  propietario_id: string | null;
  agente_id: string | null;
  inmueble_id: string;
  social_account_id: string | null;
  network: "facebook" | "instagram";
  attempt_count: number;
  external_container_id: string | null;
};

type PropiedadRow = {
  id: string;
  codigo: string | null;
  titulo: string | null;
  descripcion: string | null;
  operacion: string | null;
  tipo: string | null;
  ciudad: string | null;
  barrio: string | null;
  direccion: string | null;
  precio: number | null;
  moneda: string | null;
  precio_periodo: string | null;
  dormitorios: number | null;
  banos: number | null;
  cocheras: number | null;
  superficie_m2: number | null;
};

type ConexionRow = {
  id: string;
  facebook_page_id: string | null;
  instagram_account_id: string | null;
  access_token_encrypted: string;
  status: string;
};

async function rescueStuck(pool: Pool): Promise<number> {
  const { rows } = await queryWithRetry<{ id: string }>(
    pool,
    "UPDATE \"alquiloya\".\"publicaciones_sociales\"" +
    "   SET status = 'pending'," +
    "       updated_at = now()" +
    " WHERE empresa_id = $1::uuid" +
    "   AND status = 'processing'" +
    "   AND updated_at < now() - ($2::text || ' minutes')::interval" +
    " RETURNING id",
    [ALQUILOYA_EMPRESA_ID, String(STUCK_MINUTES)],
  );
  return rows.length;
}

async function pickJobs(pool: Pool): Promise<JobRow[]> {
  // Lock + reserve
  const { rows } = await queryWithRetry<JobRow>(
    pool,
    "WITH cte AS (" +
    "  SELECT id FROM \"alquiloya\".\"publicaciones_sociales\"" +
    "   WHERE empresa_id = $1::uuid" +
    "     AND status = 'pending'" +
    "     AND (next_retry_at IS NULL OR next_retry_at <= now())" +
    "   ORDER BY created_at ASC" +
    "   LIMIT $2" +
    "   FOR UPDATE SKIP LOCKED" +
    ")" +
    " UPDATE \"alquiloya\".\"publicaciones_sociales\" p" +
    "    SET status = 'processing', updated_at = now()" +
    "   FROM cte" +
    "  WHERE p.id = cte.id" +
    " RETURNING p.id, p.propietario_id, p.agente_id, p.inmueble_id," +
    "           p.social_account_id, p.network, p.attempt_count, p.external_container_id",
    [ALQUILOYA_EMPRESA_ID, BATCH_SIZE],
  );
  return rows;
}

async function loadPropiedad(pool: Pool, inmuebleId: string): Promise<PropiedadRow | null> {
  const { rows } = await queryWithRetry<PropiedadRow>(
    pool,
    "SELECT id, codigo, titulo, descripcion, operacion, tipo, ciudad, barrio," +
    "       direccion, precio::float8 AS precio, moneda, precio_periodo," +
    "       dormitorios, banos, cocheras, superficie_m2::float8 AS superficie_m2" +
    "  FROM \"alquiloya\".\"propiedades\"" +
    " WHERE empresa_id = $1::uuid AND id = $2::uuid LIMIT 1",
    [ALQUILOYA_EMPRESA_ID, inmuebleId],
  );
  return rows[0] || null;
}

async function loadPortadaUrl(pool: Pool, inmuebleId: string): Promise<string | null> {
  const { rows } = await queryWithRetry<{ url: string }>(
    pool,
    "SELECT url FROM \"alquiloya\".\"propiedad_fotos\"" +
    " WHERE empresa_id = $1::uuid AND propiedad_id = $2::uuid AND activo = true" +
    " ORDER BY es_portada DESC NULLS LAST, orden ASC NULLS LAST, created_at ASC" +
    " LIMIT 1",
    [ALQUILOYA_EMPRESA_ID, inmuebleId],
  );
  return rows[0]?.url || null;
}

async function loadConexion(pool: Pool, id: string): Promise<ConexionRow | null> {
  const { rows } = await queryWithRetry<ConexionRow>(
    pool,
    "SELECT id, facebook_page_id, instagram_account_id," +
    "       access_token_encrypted, status" +
    "  FROM \"alquiloya\".\"propietario_redes_sociales\"" +
    " WHERE empresa_id = $1::uuid AND id = $2::uuid LIMIT 1",
    [ALQUILOYA_EMPRESA_ID, id],
  );
  return rows[0] || null;
}

function publicLandingUrl(inmuebleId: string): string {
  const hosts = process.env.NEURA_PUBLIC_HOSTS?.split(",").map(function (s) { return s.trim(); }).filter(Boolean) ?? [];
  const host = hosts[0] || "alquiloya.com.py";
  return "https://" + host + "/publico?prop=" + encodeURIComponent(inmuebleId);
}

async function markSuccess(
  pool: Pool,
  jobId: string,
  result: { external_post_id: string; external_post_url: string | null; external_container_id?: string | null; caption: string; mediaUrl: string },
): Promise<void> {
  await queryWithRetry(
    pool,
    "UPDATE \"alquiloya\".\"publicaciones_sociales\"" +
    "   SET status = 'published'," +
    "       external_post_id = $2," +
    "       external_post_url = $3," +
    "       external_container_id = $4," +
    "       caption = $5," +
    "       media_urls = $6::jsonb," +
    "       published_at = now()," +
    "       last_error_code = NULL," +
    "       last_error_message = NULL," +
    "       updated_at = now()" +
    " WHERE id = $1::uuid",
    [
      jobId,
      result.external_post_id,
      result.external_post_url,
      result.external_container_id || null,
      result.caption,
      JSON.stringify([result.mediaUrl]),
    ],
  );
}

async function markFailure(
  pool: Pool,
  jobId: string,
  attemptCount: number,
  kind: "transient" | "auth" | "permanent",
  code: string | null,
  message: string,
  containerId?: string | null,
): Promise<void> {
  const nextAttempt = attemptCount + 1;
  // 'auth' y 'permanent' fallan definitivamente; 'transient' reintenta hasta MAX
  let status: "pending" | "failed";
  let nextRetryAtSql: string;
  if (kind === "transient" && nextAttempt < MAX_ATTEMPTS) {
    status = "pending";
    const mins = BACKOFF_MIN[attemptCount] || 60;
    nextRetryAtSql = "now() + '" + mins + " minutes'::interval";
  } else {
    status = "failed";
    nextRetryAtSql = "NULL";
  }
  const sanitized = sanitizeError(message);
  await queryWithRetry(
    pool,
    "UPDATE \"alquiloya\".\"publicaciones_sociales\"" +
    "   SET status = $2," +
    "       attempt_count = $3," +
    "       next_retry_at = " + nextRetryAtSql + "," +
    "       last_error_code = $4," +
    "       last_error_message = $5," +
    "       external_container_id = COALESCE($6, external_container_id)," +
    "       updated_at = now()" +
    " WHERE id = $1::uuid",
    [jobId, status, nextAttempt, code, sanitized, containerId || null],
  );
}

async function markConexionExpired(pool: Pool, conexionId: string): Promise<void> {
  await queryWithRetry(
    pool,
    "UPDATE \"alquiloya\".\"propietario_redes_sociales\"" +
    "   SET status = 'expired'," +
    "       auto_publish_facebook = false," +
    "       auto_publish_instagram = false," +
    "       updated_at = now()" +
    " WHERE id = $1::uuid",
    [conexionId],
  );
}

async function processJob(pool: Pool, job: JobRow): Promise<void> {
  if (!job.social_account_id) {
    await markFailure(pool, job.id, job.attempt_count, "permanent", "NO_SOCIAL_ACCOUNT", "job sin social_account_id");
    return;
  }
  const conexion = await loadConexion(pool, job.social_account_id);
  if (!conexion) {
    await markFailure(pool, job.id, job.attempt_count, "permanent", "CONEXION_NOT_FOUND", "conexion social borrada");
    return;
  }
  if (conexion.status !== "connected" || !conexion.access_token_encrypted) {
    await markFailure(pool, job.id, job.attempt_count, "auth", "CONEXION_NOT_CONNECTED", "conexion status=" + conexion.status);
    return;
  }
  const propiedad = await loadPropiedad(pool, job.inmueble_id);
  if (!propiedad) {
    await markFailure(pool, job.id, job.attempt_count, "permanent", "PROPIEDAD_NOT_FOUND", "propiedad borrada");
    return;
  }
  const rawUrl = await loadPortadaUrl(pool, job.inmueble_id);
  if (!rawUrl) {
    await markFailure(pool, job.id, job.attempt_count, "permanent", "PROPIEDAD_SIN_FOTO", "propiedad sin foto activa");
    return;
  }

  // Resolver URL publica (sube data: si hace falta)
  let mediaUrl: string;
  try {
    mediaUrl = await resolveMediaUrl(rawUrl, job.inmueble_id.slice(0, 8));
  } catch (e) {
    await markFailure(pool, job.id, job.attempt_count, "permanent", "PHOTO_NOT_UPLOADABLE", sanitizeError(e));
    return;
  }

  const caption = generateCaption({
    titulo: propiedad.titulo,
    descripcion: propiedad.descripcion,
    operacion: propiedad.operacion,
    tipo: propiedad.tipo,
    ciudad: propiedad.ciudad,
    barrio: propiedad.barrio,
    direccion: propiedad.direccion,
    precio: propiedad.precio,
    moneda: propiedad.moneda,
    precio_periodo: propiedad.precio_periodo,
    dormitorios: propiedad.dormitorios,
    banos: propiedad.banos,
    cocheras: propiedad.cocheras,
    superficie_m2: propiedad.superficie_m2,
    codigo: propiedad.codigo,
    publicUrl: publicLandingUrl(job.inmueble_id),
  });

  let token: string;
  try {
    token = decryptMetaSecret(conexion.access_token_encrypted);
  } catch (e) {
    await markFailure(pool, job.id, job.attempt_count, "permanent", "TOKEN_DECRYPT_ERR", sanitizeError(e));
    return;
  }

  try {
    let result;
    if (job.network === "facebook") {
      if (!conexion.facebook_page_id) {
        await markFailure(pool, job.id, job.attempt_count, "permanent", "NO_FB_PAGE", "conexion sin facebook_page_id");
        return;
      }
      result = await publishFacebookPhoto({
        pageId: conexion.facebook_page_id,
        pageAccessToken: token,
        imageUrl: mediaUrl,
        caption,
      });
    } else {
      if (!conexion.instagram_account_id) {
        await markFailure(pool, job.id, job.attempt_count, "permanent", "NO_IG_ACCOUNT", "conexion sin instagram_account_id");
        return;
      }
      result = await publishInstagramImage({
        igUserId: conexion.instagram_account_id,
        pageAccessToken: token,
        imageUrl: mediaUrl,
        caption,
        containerIdExisting: job.external_container_id,
      });
    }
    await markSuccess(pool, job.id, {
      external_post_id: result.external_post_id,
      external_post_url: result.external_post_url,
      external_container_id: result.external_container_id ?? null,
      caption,
      mediaUrl,
    });
  } catch (e) {
    const containerId = (e as { containerId?: string })?.containerId ?? null;
    if (e instanceof GraphError) {
      if (e.kind === "auth") {
        await markConexionExpired(pool, conexion.id);
      }
      await markFailure(pool, job.id, job.attempt_count, e.kind, e.code || "GRAPH_ERR", e.message, containerId);
    } else {
      await markFailure(pool, job.id, job.attempt_count, "transient", "UNKNOWN", sanitizeError(e), containerId);
    }
  }
}

export async function POST(request: Request) {
  const expected = process.env.INTERNAL_WORKER_SECRET?.trim();
  if (!expected) {
    return NextResponse.json({ error: "INTERNAL_WORKER_SECRET no configurado" }, { status: 500 });
  }
  const provided = request.headers.get("x-worker-secret") || "";
  if (provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pool = getChatPostgresPool();
  if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

  const rescued = await rescueStuck(pool);
  const jobs = await pickJobs(pool);

  const summary: Array<{ id: string; network: string; status: "published" | "failed_or_retry" }> = [];
  for (const job of jobs) {
    try {
      await processJob(pool, job);
      summary.push({ id: job.id, network: job.network, status: "published" });
    } catch (e) {
      // processJob NO deberia lanzar (siempre marca resultado). Si algo escapa,
      // lo forzamos a failed_or_retry sin colgar el batch.
      console.error("[meta-worker] processJob escapó:", sanitizeError(e));
      try {
        await markFailure(pool, job.id, job.attempt_count, "transient", "UNCAUGHT", sanitizeError(e));
      } catch { /* noop */ }
      summary.push({ id: job.id, network: job.network, status: "failed_or_retry" });
    }
  }

  return NextResponse.json({
    success: true,
    rescued_stuck: rescued,
    processed: jobs.length,
    summary,
  });
}
