// AES-256-GCM para cifrar access_tokens de Meta antes de guardarlos en DB.
// Clona el patron de src/lib/sifen/security.ts pero con KEY propia
// (META_SECRETS_KEY) para que la rotacion sea independiente.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const KDF_SALT = "neura-meta-kdf-v1";
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const PREFIX = "neura-meta:v1:";

function requireMetaSecretsKeyBytes(): Buffer {
  const raw = process.env.META_SECRETS_KEY?.trim();
  if (!raw || raw.length < 16) {
    throw new Error(
      "META_SECRETS_KEY no esta definida o es demasiado corta (minimo 16 caracteres). " +
        "Configure un secreto fuerte en el servidor.",
    );
  }
  return scryptSync(raw, KDF_SALT, 32, SCRYPT_PARAMS);
}

export function encryptMetaSecret(plaintext: string): string {
  const key = requireMetaSecretsKeyBytes();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptMetaSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    throw new Error("Formato de secreto Meta cifrado no reconocido o version incompatible");
  }
  const rest = stored.slice(PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 3) {
    throw new Error("Payload Meta cifrado corrupto");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  if (iv.length !== IV_LEN) {
    throw new Error("IV Meta invalido");
  }
  const key = requireMetaSecretsKeyBytes();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
