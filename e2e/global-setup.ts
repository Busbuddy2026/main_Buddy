import { config } from "dotenv";
import { Client } from "pg";
import { data, manager, masters } from "./helpers";

interface Trackers {
  configured: boolean;
  vehicles: Array<{ vehicleId: string; busId: string | null }>;
}

/**
 * Runs once before the suite, against the test database only.
 *
 * Sign-in rate limits are stored in the database, so back-to-back runs would
 * trip the OTP and PIN limits: clear them first.
 *
 * The tracker specs drive Bus 12 against the school's LivePin account. The
 * test database is seeded without a link, so link Bus 12 to the account's
 * first tracker once, before the run. Without LivePin credentials this does
 * nothing and those specs fail on purpose: they need a real tracker.
 */
export default async function globalSetup() {
  config({ path: ".env.local", quiet: true });
  const url = process.env.DATABASE_URL_TEST;
  if (!url || url === process.env.DATABASE_URL) throw new Error("Set DATABASE_URL_TEST to a separate test database.");
  const pg = new Client({ connectionString: url });
  await pg.connect();
  try {
    await pg.query('DELETE FROM transport."RateLimitHit"');
  } finally {
    await pg.end();
  }

  const admin = await manager();
  try {
    const trackers = await data<Trackers>(await admin.get("/api/admin/tracking/vehicles"));
    if (!trackers.configured || !trackers.vehicles.length) return;
    const bus = (await masters(admin)).buses.find((b) => b.id === "12");
    if (!bus) throw new Error("Bus 12 is missing: seed the test database with `npm run db:seed:demo`.");
    if (trackers.vehicles.some((v) => v.busId === bus.uid)) return;
    const free = trackers.vehicles.find((v) => !v.busId) ?? trackers.vehicles[0]!;
    await data(await admin.put("/api/admin/tracking/links", { data: { busId: bus.uid, vehicleId: free.vehicleId } }));
  } finally {
    await admin.dispose();
  }
}
