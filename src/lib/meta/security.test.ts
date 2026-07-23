// Tests unitarios del cifrado Meta.
// Correr con: node --experimental-strip-types --test src/lib/meta/security.test.ts (Node >= 22.6)

import test from "node:test";
import assert from "node:assert/strict";

process.env.META_SECRETS_KEY = "test-key-32-bytes-minimum-for-scrypt-derivation";

const { encryptMetaSecret, decryptMetaSecret } = await import("./security.ts");

test("roundtrip encrypt/decrypt devuelve el mismo string", () => {
  const plaintext = "EAABsbCS1234567890xxxxxx-mocked-page-access-token";
  const enc = encryptMetaSecret(plaintext);
  assert.ok(enc.startsWith("neura-meta:v1:"), "prefix correcto");
  const dec = decryptMetaSecret(enc);
  assert.equal(dec, plaintext);
});

test("dos encryptions del mismo plaintext producen ciphertexts distintos (IV random)", () => {
  const plaintext = "same-token";
  const a = encryptMetaSecret(plaintext);
  const b = encryptMetaSecret(plaintext);
  assert.notEqual(a, b);
  assert.equal(decryptMetaSecret(a), plaintext);
  assert.equal(decryptMetaSecret(b), plaintext);
});

test("descifrar payload corrupto tira error", () => {
  const enc = encryptMetaSecret("hola");
  const parts = enc.split(":");
  parts[3] = Buffer.from("corrupted-tag-value").toString("base64");
  assert.throws(() => decryptMetaSecret(parts.join(":")));
});

test("prefijo desconocido tira error de formato", () => {
  assert.throws(() => decryptMetaSecret("otro-prefijo:v1:aa:bb:cc"), /Formato/);
});

test("descifrar sin la key falla", () => {
  const enc = encryptMetaSecret("secret");
  const prev = process.env.META_SECRETS_KEY;
  delete process.env.META_SECRETS_KEY;
  try {
    assert.throws(() => decryptMetaSecret(enc), /META_SECRETS_KEY/);
  } finally {
    process.env.META_SECRETS_KEY = prev;
  }
});
