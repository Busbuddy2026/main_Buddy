import { expect, request, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

/**
 * Shared fixtures for the end-to-end suites. Everything a spec changes it
 * creates first, with a run-unique suffix, so the seeded demo data stays as
 * it is and the specs can run again on the same database.
 */

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
export const uniq = () => `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 10)}`;

export interface Masters {
  buses: Array<{ id: string; uid: string; driver: string; attendant: string; route: string; status: string }>;
  routes: Array<{ id: string; code: string; name: string }>;
  stops: Array<{ id: string; name: string; onRoutes: Record<string, { seq: number }> }>;
  students: Array<{ id: string; name: string; am: string; pm: string; bus: string; stop: string }>;
  drivers: Array<{ id: string; name: string; crewId: string }>;
  attendants: Array<{ id: string; name: string; crewId: string }>;
  trips: Array<{ id: string; code: string; name: string; status: string }>;
  busDocs: Record<string, Record<string, { id: string; file: string }>>;
}

export async function data<T>(res: APIResponse): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: { message: string } };
  if (!res.ok()) throw new Error(`${res.url()} → ${res.status()} ${body.error?.message ?? ""}`);
  return body.data as T;
}

export async function adminApi(username: string, password: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE });
  await data(await ctx.post("/api/auth/admin/login", { data: { username, password } }));
  return ctx;
}

export const manager = () => adminApi("transport", "demo1234");
export const principal = () => adminApi("principal", "demo1234");
export const viewer = () => adminApi("office", "demo1234");

/** An OFFICE_STAFF account made for this run (the seed has none). */
export async function officeStaff(): Promise<APIRequestContext> {
  const p = await principal();
  const username = `staff${uniq()}`;
  const password = "e2e-staff-pass";
  await data(await p.post("/api/admin/users", { data: { name: "E2E Staff", username, password, role: "OFFICE_STAFF" } }));
  await p.dispose();
  return adminApi(username, password);
}

export async function parentApi(phone: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE });
  const { devCode } = await data<{ devCode?: string }>(await ctx.post("/api/auth/parent/otp", { data: { phone } }));
  if (!devCode) throw new Error("OTP was not echoed; set DEV_ECHO_SECRETS=1 for the dev server");
  await data(await ctx.post("/api/auth/parent/verify", { data: { phone, code: devCode } }));
  return ctx;
}

export async function crewApi(crewId: string, pin: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE });
  await data(await ctx.post("/api/auth/crew/login", { data: { crewId, pin, deviceId: `e2e-device-${uniq()}` } }));
  return ctx;
}

export const masters = (ctx: APIRequestContext) => ctx.get("/api/admin/masters").then((r) => data<Masters>(r));

/**
 * A self-contained bus for one spec: a new attendant and driver (with their
 * PINs), a new bus on route R1, and a new student at Botanical Garden whose
 * parent has a new phone number.
 */
export async function makeBus(admin: APIRequestContext) {
  const n = uniq();
  const m = await masters(admin);
  const route = m.routes.find((r) => r.code === "R1")!;
  const stop = m.stops.find((s) => s.name === "Botanical Garden")!;
  const attendant = await data<{ id: string; crewId: string; pin: string }>(
    await admin.post("/api/admin/attendants", { data: { name: `E2E Attendant ${n}`, phone: `98${n.slice(0, 5)}111`.slice(0, 10), busId: "" } }),
  );
  const driver = await data<{ id: string; crewId: string; pin: string }>(
    await admin.post("/api/admin/drivers", {
      data: { name: `E2E Driver ${n}`, phone: `97${n.slice(0, 5)}222`.slice(0, 10), licenceNo: `TS02E2E${n}`, licenceExpiry: "14 Mar 2030", busId: "" },
    }),
  );
  const number = `E${n.slice(-5)}`;
  const after = await data<{ data: Masters }>(
    await admin.post("/api/admin/buses", {
      data: { number, registration: `TS 09 E2E ${n}`, capacity: "30", attendantId: attendant.id, driverId: driver.id, routeId: route.id },
    }),
  );
  const bus = after.data.buses.find((b) => b.id === number)!;
  const childName = `E2E Child ${n}`;
  const parentPhone = `96${n.padEnd(8, "7")}`.slice(0, 10);
  const created = await data<{ id: string }>(
    await admin.post("/api/admin/students", {
      data: { name: childName, cls: "Grade 4 · A", busId: bus.uid, routeId: route.id, stopId: stop.id, parentName: `E2E Parent ${n}`, parentPhone },
    }),
  );
  return { n, route, stop, attendant, driver, bus, number, childName, childId: created.id, parentPhone };
}

/** Sign in to the crew app: role switch, four digits, then the PIN. */
export async function crewSignIn(page: Page, crewId: string, pin: string) {
  await page.goto("/crew");
  await expect(page.getByRole("heading", { name: "Crew sign in" })).toBeVisible();
  await page.getByRole("button", { name: crewId.startsWith("GF-DRV-") ? "driver" : "attendant", exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Delete" }).click();
  for (const d of crewId.slice(-4)) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("4-digit PIN").fill(pin);
}

/** Sign in to the parent app through its keypad. */
export async function parentSignIn(page: Page, phone: string) {
  await page.goto("/parent");
  for (let i = 0; i < 10; i++) await page.getByRole("button", { name: "Delete" }).click();
  for (const d of phone) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "Send OTP" }).click();
  await expect(page.getByText(/Development build: the code is \d{6}/)).toBeVisible();
  await page.getByRole("button", { name: "Verify and sign in" }).click();
}

export async function adminSignIn(page: Page, username: string, password: string) {
  await page.goto("/admin");
  await page.getByLabel("USERNAME").fill(username);
  await page.getByRole("textbox", { name: "PASSWORD" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation").first()).toBeVisible();
}
