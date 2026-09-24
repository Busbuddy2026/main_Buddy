import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validateDemoRequest } from "@/lib/marketing/demo-request";

/*
 * POST /api/demo-request — records a Bus Buddy demo request.
 *
 * Writes to the `demo_requests` table; see
 * docs/handoff/bus-buddy/demo-requests.sql for the schema and its RLS policy.
 *
 * The insert runs with the service-role key when one is configured, which lets
 * the table carry no public policy at all. Without it the publishable key is
 * used, and the table needs the anon INSERT policy in that migration.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const TABLE = "demo_requests";

/*
 * Best-effort throttle. Serverless gives each instance its own memory, so this
 * slows a flood against a warm instance rather than stopping a distributed one
 * — real rate limiting belongs at the edge (Vercel WAF, Cloudflare). It is here
 * because an open insert endpoint with no ceiling at all is worse.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function overLimit(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { ok: false, message: "The demo request inbox is not configured yet." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  // Honeypot: a field no person can see, so anything in it is a bot. Answered
  // with success on purpose — a rejection just teaches the bot to try again.
  const honeypot = (body as Record<string, unknown> | null)?.company;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const parsed = validateDemoRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  // Counted here, not on arrival: a rejected request costs no database write,
  // and someone correcting a typo five times should not be locked out.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (overLimit(ip)) {
    return NextResponse.json(
      { ok: false, message: "Too many requests just now. Please try again in a minute." },
      { status: 429 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from(TABLE).insert({
    name: parsed.value.name,
    email: parsed.value.email,
    school: parsed.value.school,
    buses: parsed.value.buses || null,
    note: parsed.value.note || null,
    interests: parsed.value.interests,
  });

  if (error) {
    // Logged for the deploy's own logs; the caller gets nothing that would
    // describe the database back to them.
    console.error(`[demo-request] insert failed: ${error.message}`);
    return NextResponse.json(
      { ok: false, message: "We could not record that just now. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
