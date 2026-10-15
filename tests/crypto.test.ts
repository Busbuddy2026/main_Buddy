import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashSecret, newOtp, newToken, sha256, verifySecret } from "@/server/auth/crypto";

describe("secrets", () => {
  it("verifies the right secret and rejects the wrong one", async () => {
    const stored = await hashSecret("1234");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifySecret("1234", stored)).toBe(true);
    expect(await verifySecret("1235", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashSecret("same")).not.toBe(await hashSecret("same"));
  });

  it("never accepts the dummy hash used for unknown accounts", async () => {
    expect(await verifySecret("", DUMMY_HASH)).toBe(false);
    expect(await verifySecret("demo1234", DUMMY_HASH)).toBe(false);
  });

  it("rejects malformed stored values", async () => {
    expect(await verifySecret("x", "plain-text")).toBe(false);
  });

  it("makes six-digit codes and unguessable tokens", () => {
    for (let i = 0; i < 50; i++) expect(newOtp()).toMatch(/^\d{6}$/);
    expect(newToken()).toHaveLength(43);
    expect(newToken()).not.toBe(newToken());
    expect(sha256("a")).toHaveLength(64);
  });
});
