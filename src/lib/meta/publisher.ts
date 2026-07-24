// Publisher a Meta Graph API para AlquiloYa.
// Recibe una publicacion (job) + la conexion Meta + los datos de la propiedad
// y hace la llamada a FB Photos o IG container+publish.
//
// Devuelve { external_post_id, external_post_url, external_container_id? }
// o throws con GraphError (transient / auth / permanent).

import { graphRequest, GraphError } from "./graph-client";

export type PublisherResult = {
  external_post_id: string;
  external_post_url: string | null;
  external_container_id?: string | null;
};

/** Publica UNA imagen + caption en una Facebook Page. */
export async function publishFacebookPhoto(opts: {
  pageId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<PublisherResult> {
  // POST /{page-id}/photos con url + caption. Devuelve { id, post_id }.
  const res = await graphRequest<{ id: string; post_id?: string }>({
    method: "POST",
    path: "/" + opts.pageId + "/photos",
    accessToken: opts.pageAccessToken,
    body: {
      url: opts.imageUrl,
      caption: opts.caption,
      published: true,
    },
  });
  const post_id = res.post_id || res.id;
  const url = post_id ? "https://www.facebook.com/" + post_id : null;
  return {
    external_post_id: post_id,
    external_post_url: url,
  };
}

/**
 * Publica en Instagram Business/Creator. Es un flujo de 2 pasos:
 *   1) crear container:  POST /{ig-user-id}/media
 *   2) polling status:   GET  /{container-id}?fields=status_code
 *   3) publish:          POST /{ig-user-id}/media_publish { creation_id }
 *
 * pageAccessToken es el token de la Page (Meta lo acepta para IG business
 * account vinculado a esa Page).
 */
export async function publishInstagramImage(opts: {
  igUserId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
  containerIdExisting?: string | null; // si ya se creo antes, retomamos
}): Promise<PublisherResult> {
  let containerId = opts.containerIdExisting || null;

  // Paso 1: crear container si no lo tenemos
  if (!containerId) {
    const created = await graphRequest<{ id: string }>({
      method: "POST",
      path: "/" + opts.igUserId + "/media",
      accessToken: opts.pageAccessToken,
      body: {
        image_url: opts.imageUrl,
        caption: opts.caption,
      },
    });
    containerId = created.id;
    if (!containerId) {
      throw new GraphError("IG media container sin id", { kind: "permanent", httpStatus: 0 });
    }
  }

  // Paso 2: polling hasta FINISHED o error. Max 12 tries * 2s = 24s.
  // Instagram suele quedar FINISHED en ~2-6s.
  const MAX_TRIES = 12;
  const POLL_MS = 2000;
  let statusCode: string | null = null;
  for (let i = 0; i < MAX_TRIES; i++) {
    const s = await graphRequest<{ status_code: string; status?: string }>({
      method: "GET",
      path: "/" + containerId,
      accessToken: opts.pageAccessToken,
      query: { fields: "status_code,status" },
    });
    statusCode = s.status_code || null;
    if (statusCode === "FINISHED") break;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new GraphError(
        "IG container en estado " + statusCode,
        { kind: "permanent", httpStatus: 0 },
      );
    }
    await new Promise(function (r) { setTimeout(r, POLL_MS); });
  }
  if (statusCode !== "FINISHED") {
    // Guardamos el container para retomar en un retry (evita re-subir el media).
    const err: GraphError & { containerId?: string } = new GraphError(
      "IG container timeout (ultimo status: " + statusCode + ")",
      { kind: "transient", httpStatus: 0 },
    );
    err.containerId = containerId;
    throw err;
  }

  // Paso 3: publish
  const pub = await graphRequest<{ id: string }>({
    method: "POST",
    path: "/" + opts.igUserId + "/media_publish",
    accessToken: opts.pageAccessToken,
    body: { creation_id: containerId },
  });
  if (!pub?.id) {
    throw new GraphError("IG publish sin id", { kind: "permanent", httpStatus: 0 });
  }
  // IG no da URL publica directa. Podemos derivar buscando el media -> permalink.
  let permalink: string | null = null;
  try {
    const info = await graphRequest<{ permalink?: string }>({
      method: "GET",
      path: "/" + pub.id,
      accessToken: opts.pageAccessToken,
      query: { fields: "permalink" },
    });
    permalink = info.permalink || null;
  } catch { /* opcional */ }

  return {
    external_post_id: pub.id,
    external_post_url: permalink,
    external_container_id: containerId,
  };
}
