import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts small secrets (vendor API secrets) for storage: AES-256-GCM with a
 * random IV, stored as "v1:<iv>:<tag>:<ciphertext>" in base64. The key is
 * `TRACKING_ENC_KEY` (32 bytes, base64) and never touches the database.
 */

function key(): Buffer {
  const raw = process.env.TRACKING_ENC_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (buf.length !== 32) throw new Error("TRACKING_ENC_KEY must be 32 bytes, base64-encoded.");
  return buf;
}

export function seal(plain: string, k: Buffer = key()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

export function open(sealed: string, k: Buffer = key()): string {
  const [v, iv, tag, body] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("Unreadable secret.");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}

/** "••••6z5" — enough to recognise which secret is stored. */
export const mask = (secret: string) => `••••${secret.slice(-4)}`;
