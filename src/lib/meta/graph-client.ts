// Wrapper de fetch al Meta Graph API.
// - Version centralizada via META_GRAPH_API_VERSION (default v21.0).
// - Timeout duro (10s) para no colgar el worker.
// - Clasificacion de errores: transient / auth / permanent.
// - JAMAS loguea el access_token ni el appsecret_proof.

import { createHmac } from "node:crypto";

const DEFAULT_VERSION = "v21.0";
const DEFAULT_TIMEOUT_MS = 10_000;

export type GraphErrorKind = "transient" | "auth" | "permanent";

export class GraphError extends Error {
  readonly kind: GraphErrorKind;
  readonly httpStatus: number;
  readonly code: string | null;
  readonly subcode: string | null;
  readonly type: string | null;
  constructor(
    message: string,
    opts: {
      kind: GraphErrorKind;
      httpStatus: number;
      code?: number | string | null;
      subcode?: number | string | null;
      type?: string | null;
    },
  ) {
    super(message);
    this.name = "GraphError";
    this.kind = opts.kind;
    this.httpStatus = opts.httpStatus;
    this.code = opts.code != null ? String(opts.code) : null;
    this.subcode = opts.subcode != null ? String(opts.subcode) : null;
    this.type = opts.type ?? null;
  }
}

function graphVersion(): string {
  return process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_VERSION;
}

function baseUrl(): string {
  return "https://graph.facebook.com/" + graphVersion();
}

function appsecretProof(accessToken: string): string {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) throw new Error("META_APP_SECRET requerido");
  return createHmac("sha256", secret).update(accessToken).digest("hex");
}

function classify(
  httpStatus: number,
  metaCode: number | string | null,
  _metaSubcode: number | string | null,
  metaType: string | null,
): GraphErrorKind {
  if (httpStatus === 429) return "transient";
  const codeStr = metaCode != null ? String(metaCode) : "";
  if (metaType === "OAuthException" || codeStr === "190" || codeStr === "102") {
    return "auth";
  }
  if (httpStatus >= 500) return "transient";
  return "permanent";
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(
      () => rej(new GraphError("Timeout " + ms + "ms", { kind: "transient", httpStatus: 0 })),
      ms,
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t!);
  }
}

export type GraphRequest = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  accessToken: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
};

export async function graphRequest<T = unknown>(req: GraphRequest): Promise<T> {
  const url = new URL(baseUrl() + req.path);
  const proof = appsecretProof(req.accessToken);
  const params = new URLSearchParams();
  params.set("access_token", req.accessToken);
  params.set("appsecret_proof", proof);
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null) params.set(k, String(v));
    }
  }

  let fetchInit: RequestInit;
  if (req.method === "GET" || req.method === "DELETE") {
    url.search = params.toString();
    fetchInit = { method: req.method };
  } else {
    const bodyParams = new URLSearchParams();
    for (const [k, v] of params) bodyParams.set(k, v);
    if (req.body) {
      for (const [k, v] of Object.entries(req.body)) {
        if (v == null) continue;
        bodyParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
    }
    fetchInit = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    };
  }

  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const res = await withTimeout(fetch(url.toString(), fetchInit), timeoutMs);
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch { /* ignore */ }

  if (!res.ok) {
    const err = (parsed as { error?: {
      message?: string;
      code?: number;
      error_subcode?: number;
      type?: string;
      fbtrace_id?: string;
    } } | null)?.error;
    const kind = classify(res.status, err?.code ?? null, err?.error_subcode ?? null, err?.type ?? null);
    const msg = err?.message ? String(err.message) : "HTTP " + res.status;
    throw new GraphError(msg, {
      kind,
      httpStatus: res.status,
      code: err?.code ?? null,
      subcode: err?.error_subcode ?? null,
      type: err?.type ?? null,
    });
  }
  return parsed as T;
}

export type MetaTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<MetaTokenResponse> {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("META_APP_ID y META_APP_SECRET requeridos");
  const url = new URL(baseUrl() + "/oauth/access_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  const res = await withTimeout(fetch(url.toString(), { method: "GET" }), DEFAULT_TIMEOUT_MS);
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* noop */ }
  if (!res.ok) {
    const err = (parsed as { error?: { message?: string; code?: number; type?: string } } | null)?.error;
    throw new GraphError(err?.message || ("HTTP " + res.status), {
      kind: classify(res.status, err?.code ?? null, null, err?.type ?? null),
      httpStatus: res.status,
      code: err?.code ?? null,
      type: err?.type ?? null,
    });
  }
  return parsed as MetaTokenResponse;
}

export async function upgradeToLongLivedToken(shortToken: string): Promise<MetaTokenResponse> {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("META_APP_ID y META_APP_SECRET requeridos");
  const url = new URL(baseUrl() + "/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await withTimeout(fetch(url.toString(), { method: "GET" }), DEFAULT_TIMEOUT_MS);
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* noop */ }
  if (!res.ok) {
    const err = (parsed as { error?: { message?: string; code?: number; type?: string } } | null)?.error;
    throw new GraphError(err?.message || ("HTTP " + res.status), {
      kind: classify(res.status, err?.code ?? null, null, err?.type ?? null),
      httpStatus: res.status,
      code: err?.code ?? null,
      type: err?.type ?? null,
    });
  }
  return parsed as MetaTokenResponse;
}

export type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[];
};

export async function listPagesForUser(userAccessToken: string): Promise<MetaPage[]> {
  const res = await graphRequest<{ data: MetaPage[] }>({
    method: "GET",
    path: "/me/accounts",
    accessToken: userAccessToken,
    query: { fields: "id,name,access_token,category,tasks", limit: 100 },
  });
  return res?.data ?? [];
}

export type PageInstagramInfo = {
  id: string;
  instagram_business_account?: { id: string } | null;
};

export async function getPageInstagramInfo(
  pageId: string,
  pageAccessToken: string,
): Promise<PageInstagramInfo> {
  return graphRequest<PageInstagramInfo>({
    method: "GET",
    path: "/" + pageId,
    accessToken: pageAccessToken,
    query: { fields: "id,instagram_business_account" },
  });
}

export type IgAccountInfo = { id: string; username?: string; name?: string };

export async function getIgAccountInfo(
  igAccountId: string,
  pageAccessToken: string,
): Promise<IgAccountInfo> {
  return graphRequest<IgAccountInfo>({
    method: "GET",
    path: "/" + igAccountId,
    accessToken: pageAccessToken,
    query: { fields: "id,username,name" },
  });
}

export type DebugTokenResponse = {
  data: {
    app_id?: string;
    type?: string;
    application?: string;
    data_access_expires_at?: number;
    expires_at?: number;
    is_valid?: boolean;
    scopes?: string[];
    user_id?: string;
  };
};

export async function debugToken(inputToken: string): Promise<DebugTokenResponse> {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("META_APP_ID y META_APP_SECRET requeridos");
  const url = new URL(baseUrl() + "/debug_token");
  url.searchParams.set("input_token", inputToken);
  url.searchParams.set("access_token", appId + "|" + appSecret);
  const res = await withTimeout(fetch(url.toString(), { method: "GET" }), DEFAULT_TIMEOUT_MS);
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* noop */ }
  if (!res.ok) throw new GraphError("debug_token failed", { kind: "permanent", httpStatus: res.status });
  return parsed as DebugTokenResponse;
}

export function buildAuthorizeUrl(opts: { state: string; redirectUri: string; scopes: string[] }): string {
  const appId = process.env.META_APP_ID?.trim();
  if (!appId) throw new Error("META_APP_ID requerido");
  const u = new URL("https://www.facebook.com/" + graphVersion() + "/dialog/oauth");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", opts.scopes.join(","));
  return u.toString();
}

export const REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];
