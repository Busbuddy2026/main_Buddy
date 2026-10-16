import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { BASE, crewApi, manager, officeStaff, parentApi, principal, viewer } from "./helpers";

/**
 * Who may call what. Every endpoint, every kind of login.
 *
 * Calls use ids that do not exist and empty bodies, so nothing is changed:
 * the role check runs before the lookup and the body validation, so an
 * allowed caller gets 2xx/400/404/409 and a refused one gets 403 (401 when
 * signed out).
 */

type Who = "super" | "manager" | "staff" | "viewer" | "parent" | "crew" | "anon";
type Call = { method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string; body?: unknown; allow: Who[] };

const ADMINS: Who[] = ["super", "manager", "staff", "viewer"];
const WRITERS: Who[] = ["super", "manager", "staff"];
const LEADS: Who[] = ["super", "manager"];

const CALLS: Call[] = [
  // Admin reads
  ...[
    "/api/admin/masters", "/api/admin/attendance/today", "/api/admin/attendance/history",
    "/api/admin/attendance/export", "/api/admin/incidents", "/api/admin/incidents/nope",
    "/api/admin/cctv/cameras", "/api/admin/cctv/recordings", "/api/admin/analytics",
    "/api/admin/analytics/drivers", "/api/admin/reports/trips", "/api/admin/reports/incidents",
    "/api/admin/reports/attendance", "/api/admin/settings", "/api/admin/trip-manifests/nope",
    "/api/admin/documents/nope", "/api/auth/admin/session",
  ].map((path): Call => ({ method: "GET", path, allow: ADMINS })),
  { method: "GET", path: "/api/admin/users", allow: ["super"] },
  { method: "GET", path: "/api/admin/live", allow: ADMINS },
  { method: "GET", path: "/api/admin/tracking/vehicles", allow: LEADS },
  { method: "PUT", path: "/api/admin/tracking/links", body: {}, allow: LEADS },
  { method: "POST", path: "/api/admin/cctv/buses/nope/stream", allow: WRITERS },

  // Master records
  ...["buses", "students", "drivers", "attendants", "routes", "stops", "school-trips"].flatMap((r): Call[] => [
    { method: "POST", path: `/api/admin/${r}`, body: {}, allow: WRITERS },
    { method: "PATCH", path: `/api/admin/${r}/nope`, body: {}, allow: WRITERS },
    { method: "DELETE", path: `/api/admin/${r}/nope`, allow: LEADS },
  ]),
  { method: "POST", path: "/api/admin/routes/nope/move-stop", body: {}, allow: WRITERS },
  { method: "POST", path: "/api/admin/drivers/nope/reset-pin", allow: WRITERS },
  { method: "POST", path: "/api/admin/attendants/nope/reset-pin", allow: WRITERS },
  { method: "POST", path: "/api/admin/buses/nope/upload-url", body: {}, allow: WRITERS },
  { method: "POST", path: "/api/admin/buses/nope/documents", body: {}, allow: WRITERS },
  { method: "POST", path: "/api/admin/school-trips/nope/manifest", body: {}, allow: WRITERS },
  { method: "POST", path: "/api/admin/school-trips/nope/consent", body: {}, allow: WRITERS },
  { method: "POST", path: "/api/admin/school-trips/nope/status", body: {}, allow: WRITERS },
  { method: "DELETE", path: "/api/admin/documents/nope", allow: WRITERS },

  // Attendance, safety, settings
  { method: "POST", path: "/api/admin/attendance/correct", body: {}, allow: WRITERS },
  { method: "POST", path: "/api/admin/absences/nope/acknowledge", allow: WRITERS },
  { method: "POST", path: "/api/admin/incidents", body: {}, allow: WRITERS },
  { method: "PATCH", path: "/api/admin/incidents/nope", body: {}, allow: WRITERS },
  { method: "PATCH", path: "/api/admin/cctv/cameras/nope", body: {}, allow: WRITERS },
  { method: "POST", path: "/api/admin/cctv/cameras/nope/view", allow: WRITERS },
  { method: "POST", path: "/api/admin/cctv/recordings/nope/view", allow: WRITERS },
  { method: "POST", path: "/api/admin/cctv/buses/nope/ticket", allow: WRITERS },
  { method: "POST", path: "/api/admin/cctv/backup", body: { busId: "nope" }, allow: LEADS },
  { method: "PUT", path: "/api/admin/cctv/drive", body: {}, allow: LEADS },
  { method: "PATCH", path: "/api/admin/settings", body: {}, allow: LEADS },
  { method: "POST", path: "/api/admin/users", body: {}, allow: ["super"] },
  { method: "PATCH", path: "/api/admin/users/nope", body: {}, allow: ["super"] },

  // Parent app
  ...[
    "/api/auth/parent/session", "/api/parent/notifications", "/api/parent/children/nope/today",
    "/api/parent/children/nope/history", "/api/parent/children/nope/contacts", "/api/parent/children/nope/absences",
  ].map((path): Call => ({ method: "GET", path, allow: ["parent"] })),
  { method: "POST", path: "/api/parent/children/nope/absences", body: {}, allow: ["parent"] },
  { method: "DELETE", path: "/api/parent/absences/nope", allow: ["parent"] },
  { method: "POST", path: "/api/parent/notifications/read", allow: ["parent"] },
  { method: "PATCH", path: "/api/parent/preferences", body: {}, allow: ["parent"] },

  // Crew app
  { method: "GET", path: "/api/auth/crew/session", allow: ["crew"] },
  { method: "GET", path: "/api/crew/plan", allow: ["crew"] },
  { method: "POST", path: "/api/crew/sync", body: { ops: [] }, allow: ["crew"] },
];

test("every endpoint allows exactly the right logins", async () => {
  test.setTimeout(180_000);
  const who: Record<Who, APIRequestContext> = {
    super: await principal(),
    manager: await manager(),
    staff: await officeStaff(),
    viewer: await viewer(),
    parent: await parentApi("9848012345"),
    crew: await crewApi("GF-ATT-0142", "1234"),
    anon: await request.newContext({ baseURL: BASE }),
  };

  const wrong: string[] = [];
  for (const call of CALLS) {
    for (const [name, ctx] of Object.entries(who) as Array<[Who, APIRequestContext]>) {
      const res = await ctx.fetch(call.path, {
        method: call.method,
        ...(call.body !== undefined ? { data: call.body } : {}),
      });
      const status = res.status();
      const allowed = call.allow.includes(name);
      const ok = allowed
        ? status < 500 && status !== 401 && status !== 403
        : name === "anon" ? status === 401 : status === 403;
      if (!ok) wrong.push(`${name.padEnd(7)} ${call.method} ${call.path} → ${status} (expected ${allowed ? "allowed" : name === "anon" ? "401" : "403"})`);
    }
  }
  expect(wrong, wrong.join("\n")).toEqual([]);

  for (const ctx of Object.values(who)) await ctx.dispose();
});
