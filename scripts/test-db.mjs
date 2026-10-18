#!/usr/bin/env node
/**
 * Runs a command against the test database instead of the real one:
 * DATABASE_URL and DIRECT_URL are both pointed at DATABASE_URL_TEST from
 * .env.local. The demo seed and the e2e server go through here, so demo
 * rows never land in the database the portal shows.
 *
 *   node scripts/test-db.mjs npm run db:deploy
 */
import { spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  process.stderr.write("Set DATABASE_URL_TEST in .env.local (a separate database for demo data and tests).\n");
  process.exit(1);
}
if (testUrl === process.env.DATABASE_URL || testUrl === process.env.DIRECT_URL) {
  process.stderr.write("DATABASE_URL_TEST points at the real database. Use a separate one.\n");
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  process.stderr.write("Usage: node scripts/test-db.mjs <command> [args…]\n");
  process.exit(1);
}

const child = spawn(cmd, args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl, GF_TEST_DB: "1" },
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
