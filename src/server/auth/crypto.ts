import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password, PIN and token primitives, on node:crypto alone.
 *
 * Secrets are hashed with scrypt (memory-hard, so a stolen table is slow to
 * crack). Tokens that are already high-entropy random values (session cookies,
 * reset links) only need SHA-256: there is nothing to brute-force.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

function derive(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, KEYLEN, { N, r: R, p: P }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** "scrypt$N$r$p$salt$hash", so parameters can be raised later. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(secret, salt);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [scheme, , , , saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await derive(secret, Buffer.from(saltB64, "base64"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A 256-bit random token, URL-safe. */
export const newToken = (): string => randomBytes(32).toString("base64url");

export const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/** A six-digit one-time code, uniformly distributed. */
export const newOtp = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** A stored hash to compare against when the account does not exist, so a
 *  missing account takes as long to reject as a wrong password. */
export const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
