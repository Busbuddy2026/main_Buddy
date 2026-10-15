import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local itself; the Prisma CLI does not.
config({ path: ".env.local", quiet: true });

/**
 * Migrations go over the direct connection (Supabase port 5432): the pooled
 * one (6543, transaction mode) cannot hold the session migrations need.
 * The app itself connects through the pool, in src/server/db.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? "",
  },
});
