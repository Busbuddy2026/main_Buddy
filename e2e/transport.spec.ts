import { expect, request, test, type APIRequestContext } from "@playwright/test";

/**
 * README §11 "works end to end", against the real API and database.
 *
 * Fixtures are created fresh through the admin API on every run (a new
 * attendant, bus and student with a new parent), so the spec never depends on
 * — or disturbs — the seeded demo data.
 */

interface Masters {
  routes: Array<{ id: string; code: string }>;
  stops: Array<{ id: string; name: string }>;
  buses: Array<{ id: string; uid: string }>;
  students: Array<{ id: string; name: string; am: string; pm: string }>;
}

async function json<T>(res: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  const body = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok() || !body.data) throw new Error(`${res.url()} → ${res.status()} ${body.error?.message ?? ""}`);
  return body.data;
}

test("attendant marks offline, the office and the parent see it", async ({ browser, baseURL }) => {
  const n = String(Date.now()).slice(-4);
  const admin = await request.newContext({ baseURL });
  await json(await admin.post("/api/auth/admin/login", { data: { email: "transport@bvm.edu.in", password: "demo1234" } }));

  // ── Fixtures: attendant → bus on R1 → student at Botanical Garden ──────
  const masters = await json<Masters>(await admin.get("/api/admin/masters"));
  const route = masters.routes.find((r) => r.code === "R1")!;
  const stop = masters.stops.find((s) => s.name === "Botanical Garden")!;
  const attendant = await json<{ id: string; crewId: string; pin: string }>(
    await admin.post("/api/admin/attendants", {
      data: { name: `E2E Attendant ${n}`, phone: `98765${n}0`, busId: "" },
    }),
  );
  const busNumber = `E${n}`;
  const afterBus = await json<{ data: Masters }>(
    await admin.post("/api/admin/buses", {
      data: { number: busNumber, registration: `TS 09 E2E ${n}`, capacity: "30", attendantId: attendant.id, driverId: "", routeId: route.id },
    }),
  );
  const busUid = afterBus.data.buses.find((b) => b.id === busNumber)!.uid;
  const childName = `E2E Child ${n}`;
  const parentPhone = `97${n}${n}`;
  await json(
    await admin.post("/api/admin/students", {
      data: { name: childName, cls: "Grade 4 · A", busId: busUid, routeId: route.id, stopId: stop.id, parentName: `E2E Parent ${n}`, parentPhone },
    }),
  );

  // ── Crew: sign in, start the morning trip, mark boarded while offline ──
  const crewContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const crew = await crewContext.newPage();
  await crew.goto("/crew");
  await expect(crew.getByRole("heading", { name: "Crew sign in" })).toBeVisible();
  for (let i = 0; i < 4; i++) await crew.getByRole("button", { name: "Delete" }).click();
  for (const digit of attendant.crewId.slice(-4)) await crew.getByRole("button", { name: digit, exact: true }).click();
  await crew.getByRole("button", { name: "Continue" }).click();
  await crew.getByLabel("4-digit PIN").fill(attendant.pin);

  await expect(crew.getByText(`BUS ${busNumber}`, { exact: true })).toBeVisible();
  await crew.getByRole("button", { name: "START TRIP" }).click();
  await expect(crew.getByText("CURRENT STOP")).toBeVisible();
  await expect(crew.getByText("All marks sent")).toBeVisible();

  await crewContext.setOffline(true);
  await crew.getByRole("button", { name: /Botanical/ }).first().click();
  const card = crew.locator("div.rounded-\\[18px\\]", { hasText: childName });
  await card.getByRole("button", { name: "Boarded" }).click();
  await expect(card.getByText(/Boarded at Botanical/)).toBeVisible();
  await crew.getByRole("button", { name: /saved on this phone|waiting to send|Sending/ }).click();
  await expect(crew.getByText(/Offline · \d+ updates? saved on this phone/)).toBeVisible();

  // Nothing has reached the office yet.
  let seen = await json<Masters>(await admin.get("/api/admin/masters"));
  expect(seen.students.find((s) => s.name === childName)?.am).toBe("Pending");

  // Back online: the queue replays on its own.
  await crewContext.setOffline(false);
  await crew.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(crew.getByText("All marks sent")).toBeVisible();

  seen = await json<Masters>(await admin.get("/api/admin/masters"));
  expect(seen.students.find((s) => s.name === childName)?.am).toBe("Boarded");

  // ── Parent: OTP sign-in (code echoed in development) ───────────────────
  const parentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const parent = await parentContext.newPage();
  await parent.goto("/parent");
  for (let i = 0; i < 10; i++) await parent.getByRole("button", { name: "Delete" }).click();
  for (const digit of parentPhone) await parent.getByRole("button", { name: digit, exact: true }).click();
  await parent.getByRole("button", { name: "Send OTP" }).click();
  await expect(parent.getByText(/Development build: the code is \d{6}/)).toBeVisible();
  await parent.getByRole("button", { name: "Verify and sign in" }).click();
  const childFirst = childName.split(" ")[0]!;
  await expect(parent.getByText(childName).first()).toBeVisible();
  // Before noon the home card follows the morning run; after, the evening one.
  const morning = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(new Date())) < 12;
  await expect(
    parent.getByText(morning ? /On the way to school|Reached school|No school today/ : /^(At school|No school today)$/).first(),
  ).toBeVisible();

  // The boarding scan reached the parent's feed.
  await parent.getByRole("link", { name: "Notifications" }).click();
  await expect(parent.getByText(`${childFirst} boarded the bus`)).toBeVisible();

  // ── Parent reports tomorrow's absence; the office sees it ──────────────
  await parent.goto("/parent/absence");
  await parent.getByRole("button", { name: "Submit" }).click();
  await expect(parent.getByText(/have been told/)).toBeVisible();
  await expect(parent.getByText(`E2E Attendant ${n}`)).toBeVisible();

  const today = await json<{ absences: Array<{ student: string; phase: string }> }>(
    await admin.get("/api/admin/attendance/today"),
  );
  expect(today.absences.find((a) => a.student === childName)?.phase).toBe("am");

  // ── A parent session is refused by the admin API ───────────────────────
  const wrongApp = await parentContext.request.get("/api/admin/masters");
  expect(wrongApp.status()).toBe(403);
  expect(((await wrongApp.json()) as { error: { code: string } }).error.code).toBe("WRONG_APP");

  await crewContext.close();
  await parentContext.close();
  await admin.dispose();
});
