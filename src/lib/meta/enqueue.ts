// Enqueuer de publicaciones sociales.
// Se llama al aprobar una propiedad (src/app/api/dashboard/alquiloya-propiedades/[id]/moderacion/route.ts).
// Busca las conexiones Meta con auto_publish_* activo del owner de la propiedad
// y crea un job por (inmueble, red) — idempotente via idempotency_key.
//
// NUNCA bloquea la aprobacion. Los errores se logean y siguen.

import { queryWithRetry } from "@/lib/supabase/pg-retry";
import type { Pool } from "pg";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

export type PropiedadOwner =
  | { ownerType: "propietario"; propietarioId: string }
  | { ownerType: "agente"; agenteId: string };

type ConexionRow = {
  id: string;
  facebook_page_id: string | null;
  instagram_account_id: string | null;
  auto_publish_facebook: boolean;
  auto_publish_instagram: boolean;
  status: string;
};

/**
 * Enfila jobs para publicar una propiedad en las redes conectadas del owner.
 * Devuelve { queued, skipped } para logging.
 */
export async function enqueuePublicaciones(pool: Pool, opts: {
  inmuebleId: string;
  owner: PropiedadOwner;
}): Promise<{ queued: number; skipped: number }> {
  const ownerType = opts.owner.ownerType;
  const ownerCol = ownerType === "agente" ? "agente_id" : "propietario_id";
  const ownerId = ownerType === "agente"
    ? (opts.owner as { agenteId: string }).agenteId
    : (opts.owner as { propietarioId: string }).propietarioId;

  // 1) Buscamos las conexiones activas del owner
  const { rows: conexiones } = await queryWithRetry<ConexionRow>(
    pool,
    "SELECT id, facebook_page_id, instagram_account_id," +
    "       auto_publish_facebook, auto_publish_instagram, status" +
    "  FROM \"alquiloya\".\"propietario_redes_sociales\"" +
    " WHERE empresa_id = $1::uuid" +
    "   AND status = 'connected'" +
    "   AND " + ownerCol + " = $2::uuid",
    [ALQUILOYA_EMPRESA_ID, ownerId],
  );

  let queued = 0;
  let skipped = 0;

  for (const c of conexiones) {
    // Facebook
    if (c.auto_publish_facebook && c.facebook_page_id) {
      const key = "prop:" + opts.inmuebleId + ":owner:" + ownerType + ":" + ownerId + ":net:fb:v1";
      const propietarioId = ownerType === "propietario" ? ownerId : null;
      const agenteId = ownerType === "agente" ? ownerId : null;
      const { rows } = await queryWithRetry<{ id: string }>(
        pool,
        "INSERT INTO \"alquiloya\".\"publicaciones_sociales\"" +
        "  (empresa_id, propietario_id, agente_id, inmueble_id," +
        "   social_account_id, network, status, idempotency_key)" +
        " VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid," +
        "         $5::uuid, 'facebook', 'pending', $6)" +
        " ON CONFLICT (empresa_id, idempotency_key) DO NOTHING" +
        " RETURNING id",
        [ALQUILOYA_EMPRESA_ID, propietarioId, agenteId, opts.inmuebleId, c.id, key],
      );
      if (rows.length > 0) queued++; else skipped++;
    }
    // Instagram
    if (c.auto_publish_instagram && c.instagram_account_id) {
      const key = "prop:" + opts.inmuebleId + ":owner:" + ownerType + ":" + ownerId + ":net:ig:v1";
      const propietarioId = ownerType === "propietario" ? ownerId : null;
      const agenteId = ownerType === "agente" ? ownerId : null;
      const { rows } = await queryWithRetry<{ id: string }>(
        pool,
        "INSERT INTO \"alquiloya\".\"publicaciones_sociales\"" +
        "  (empresa_id, propietario_id, agente_id, inmueble_id," +
        "   social_account_id, network, status, idempotency_key)" +
        " VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid," +
        "         $5::uuid, 'instagram', 'pending', $6)" +
        " ON CONFLICT (empresa_id, idempotency_key) DO NOTHING" +
        " RETURNING id",
        [ALQUILOYA_EMPRESA_ID, propietarioId, agenteId, opts.inmuebleId, c.id, key],
      );
      if (rows.length > 0) queued++; else skipped++;
    }
  }

  return { queued, skipped };
}
