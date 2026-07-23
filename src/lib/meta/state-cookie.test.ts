// Tests del state HMAC del OAuth Meta.

import test from "node:test";
import assert from "node:assert/strict";

process.env.META_SECRETS_KEY = "test-key-32-bytes-minimum-for-hmac-signing";
const { signState, verifyState } = await import("./state-cookie.ts");

const UID = "auth-user-uuid-abc";
const PID = "propietario-uuid-xyz";

test("state firmado y verificado con la cookie correcta", () => {
  const { state, nonce } = signState(UID, PID);
  const payload = verifyState(state, nonce);
  assert.equal(payload.uid, UID);
  assert.equal(payload.pid, PID);
  assert.equal(payload.n, nonce);
  assert.ok(payload.ts <= Math.floor(Date.now() / 1000));
});

test("nonce que no matchea la cookie es rechazado", () => {
  const { state } = signState(UID, PID);
  assert.throws(() => verifyState(state, "nonce-que-no-coincide"), /nonce/);
});

test("cookie ausente es rechazada", () => {
  const { state } = signState(UID, PID);
  assert.throws(() => verifyState(state, null), /nonce/);
});

test("state con firma alterada es rechazado", () => {
  const { state, nonce } = signState(UID, PID);
  const parts = state.split(".");
  const bad = parts[0] + "." + Buffer.from("firma-inventada").toString("base64url");
  assert.throws(() => verifyState(bad, nonce), /firma/);
});

test("state con payload alterado es rechazado por firma invalida", () => {
  const { state, nonce } = signState(UID, PID);
  const parts = state.split(".");
  const badPayload = Buffer.from(JSON.stringify({ uid: "otro", pid: PID, ts: 1, n: nonce }))
    .toString("base64url");
  assert.throws(() => verifyState(badPayload + "." + parts[1], nonce), /firma/);
});

test("state expirado es rechazado", async () => {
  const { createHmac } = await import("node:crypto");
  const nonce = "test-nonce-x";
  const past = Math.floor(Date.now() / 1000) - 60 * 60;
  const body = Buffer.from(JSON.stringify({ uid: UID, pid: PID, ts: past, n: nonce }))
    .toString("base64url");
  const key = Buffer.from(process.env.META_SECRETS_KEY!, "utf8");
  const sig = createHmac("sha256", key).update(body).digest("base64url");
  const state = body + "." + sig;
  assert.throws(() => verifyState(state, nonce), /expirado/);
});

test("state malformado (sin punto) es rechazado", () => {
  assert.throws(() => verifyState("sinpuntonivalidodelnada", "n"), /malformado/);
});
