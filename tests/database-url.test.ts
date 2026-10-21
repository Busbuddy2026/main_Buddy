import { describe, expect, it } from "vitest";
import { databaseUrl } from "@/server/db";

const pooled = "postgres://postgres.ref:pw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";

describe("databaseUrl", () => {
  it("prefers DATABASE_URL and leaves it as it is", () => {
    expect(databaseUrl({ DATABASE_URL: pooled, POSTGRES_PRISMA_URL: "postgres://other/db" })).toBe(pooled);
  });

  it("falls back to the Supabase integration's pooled URL", () => {
    const url = databaseUrl({ POSTGRES_PRISMA_URL: `${pooled}?sslmode=require&supa=base-pooler.x&pgbouncer=true` });
    expect(url).toContain(":6543/postgres");
    // libpq meaning of sslmode=require: encrypted, certificate not verified.
    expect(new URL(url!).searchParams.get("uselibpqcompat")).toBe("true");
  });

  it("keeps strict verification when asked for it, and is empty without a URL", () => {
    expect(databaseUrl({ DATABASE_URL: `${pooled}?sslmode=verify-full` })).not.toContain("uselibpqcompat");
    expect(databaseUrl({})).toBeUndefined();
  });
});
