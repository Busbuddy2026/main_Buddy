#!/usr/bin/env node
/**
 * Runs a command against the production database: DATABASE_URL and
 * DIRECT_URL (plus SEED_ADMIN_PASSWORD for the first seed) come from the
 * git-ignored `.env.vercel`, the same values set in Vercel. Next.js never
 * loads that file, so local dev and builds keep using `.env.local`.
 *
 *   node scripts/prod-db.mjs npm run db:deploy
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const FILE = ".env.vercel";
if (!existsSync(FILE)) {
  process.stderr.write(`Missing ${FILE}. It holds the production settings.\n`);
  process.exit(1);
}
const prod = parse(readFileSync(FILE));
for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  if (!prod[key]) {
    process.stderr.write(`Set ${key} in ${FILE} (Supabase → Project Settings → Database).\n`);
    process.exit(1);
  }
  if (/@(localhost|127\.0\.0\.1)[:/]/.test(prod[key])) {
    process.stderr.write(`${key} in ${FILE} points at this machine, not production.\n`);
    process.exit(1);
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  process.stderr.write("Usage: node scripts/prod-db.mjs <command> [args…]\n");
  process.exit(1);
}

const child = spawn(cmd, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: prod.DATABASE_URL,
    DIRECT_URL: prod.DIRECT_URL,
    ...(prod.SEED_ADMIN_PASSWORD ? { SEED_ADMIN_PASSWORD: prod.SEED_ADMIN_PASSWORD } : {}),
  },
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
