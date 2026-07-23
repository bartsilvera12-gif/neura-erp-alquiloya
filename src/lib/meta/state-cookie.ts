// State one-shot para el OAuth de Meta.
// El "state" es un HMAC firmado que incluye:
//   - uid (auth.users.id), pid (propietario_id), ts (epoch), n (nonce)
// Formato: base64url(JSON) + "." + base64url(hmac_sha256)
// Ademas cookie httpOnly con el mismo nonce para bindear el browser (CSRF).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_SEC = 10 * 60;
const COOKIE_NAME = "neura_meta_oauth_state";

function keyBytes(): Buffer {
  const raw = process.env.META_SECRETS_KEY?.trim();
  if (!raw || raw.length < 16) {
    throw new Error("META_SECRETS_KEY requerido para firmar state OAuth");
  }
  return Buffer.from(raw, "utf8");
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4);
  const padded = s + (pad < 4 ? "=".repeat(pad) : "");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export type StatePayload = { uid: string; pid: string; ts: number; n: string };

export function signState(uid: string, pid: string): { state: string; nonce: string } {
  const nonce = b64urlEncode(randomBytes(16));
  const payload: StatePayload = { uid, pid, ts: Math.floor(Date.now() / 1000), n: nonce };
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", keyBytes()).update(body).digest();
  return { state: `${body}.${b64urlEncode(sig)}`, nonce };
}

export function verifyState(state: string, cookieNonce: string | null): StatePayload {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("state malformado");
  const expected = createHmac("sha256", keyBytes()).update(body).digest();
  const got = b64urlDecode(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    throw new Error("state con firma invalida");
  }
  let payload: StatePayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as StatePayload;
  } catch {
    throw new Error("state payload corrupto");
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.ts + STATE_TTL_SEC < now) {
    throw new Error("state expirado");
  }
  if (!cookieNonce || cookieNonce !== payload.n) {
    throw new Error("nonce cookie no matchea state");
  }
  return payload;
}

export const STATE_COOKIE_NAME = COOKIE_NAME;
export const STATE_TTL_SECONDS = STATE_TTL_SEC;
