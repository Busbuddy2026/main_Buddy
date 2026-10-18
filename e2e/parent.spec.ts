import { expect, test } from "@playwright/test";
import { crewApi, data, makeBus, manager, parentSignIn } from "./helpers";
import { localDate } from "../src/lib/time";

/**
 * The parent app, through its screens: sign-in, today's trip, alerts,
 * history, track, absence (report and cancel), preferences, child switching
 * and sign-out. A fresh child is made per run; the crew marks them boarded
 * through the API so the parent has something to see.
 */

test("parent sees the trip, reports an absence and manages preferences", async ({ browser }) => {
  test.setTimeout(150_000);
  const admin = await manager();
  const fx = await makeBus(admin);

  // The attendant boards the child this morning.
  const crew = await crewApi(fx.attendant.crewId, fx.attendant.pin);
  const at = new Date().toISOString();
  const base = { date: localDate(), phase: "morning" as const, at };
  const sync = await data<{ results: Array<{ ok: boolean }> }>(
    await crew.post("/api/crew/sync", {
      data: {
        ops: [
          { ...base, opId: `start-${fx.n}`, type: "start" },
          { ...base, opId: `mark-${fx.n}`, type: "mark", clientMarkId: `cm-${fx.n}-x`, studentId: fx.childId, markPhase: "board", status: "boarded", stopId: fx.stop.id },
        ],
      },
    }),
  );
  expect(sync.results.every((r) => r.ok)).toBe(true);

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await parentSignIn(page, fx.parentPhone);
  const first = fx.childName.split(" ")[0]!;

  // Home: the child, their bus and today's state.
  await expect(page.getByText(fx.childName).first()).toBeVisible();
  await expect(page.getByText(`BUS ${fx.number}`).first()).toBeVisible();
  // Before noon the card follows the morning run; after, the evening one.
  const morning = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(new Date())) < 12;
  if (morning) {
    await expect(page.getByText(/On the way to school|Reached school|No school today/).first()).toBeVisible();
    await expect(page.getByText(`${first} boarded the bus`).or(page.getByText("No bus runs today.")).first()).toBeVisible();
  } else {
    await expect(page.getByText(/^(At school|No school today)$/).first()).toBeVisible();
    await expect(page.getByText("Return trip scheduled").or(page.getByText("No bus runs today."))).toBeVisible();
  }

  // Alerts: the boarding scan, then marked read.
  await page.getByRole("link", { name: "Notifications" }).click();
  await expect(page.getByText(`${first} boarded the bus`)).toBeVisible();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(page.getByText(`${first} boarded the bus`)).toBeVisible();
  await page.getByRole("button", { name: "Alerts", exact: true }).click();
  await expect(page.getByText("Nothing here yet")).toBeVisible();

  // History and track.
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByText(/Boarded bus at Botanical Garden/)).toBeVisible();
  await page.getByRole("link", { name: "Track" }).click();
  // The trip is running but this test bus has no tracker: the app says so.
  await expect(page.getByText(/No GPS on this bus|Not on a trip/)).toBeVisible();

  // Absence: report tomorrow's morning, see it upcoming, then cancel it.
  await page.goto("/parent/absence");
  await page.getByLabel("REASON (OPTIONAL)").fill("Family function");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/have been told/)).toBeVisible();
  await expect(page.getByText(`E2E Attendant ${fx.n}`)).toBeVisible();
  const office = await data<{ absences: Array<{ student: string; reason: string | null }> }>(await admin.get("/api/admin/attendance/today"));
  expect(office.absences.find((a) => a.student === fx.childName)?.reason).toBe("Family function");
  await page.getByRole("button", { name: "Change this" }).click();
  await page.getByRole("button", { name: "Cancel" }).first().click();
  await expect(page.getByText("UPCOMING NOTICES")).toBeHidden();
  const after = await data<{ absences: Array<{ student: string }> }>(await admin.get("/api/admin/attendance/today"));
  expect(after.absences.find((a) => a.student === fx.childName)).toBeUndefined();

  // A started trip refuses a same-day absence for it.
  await page.getByLabel("DATE").fill(localDate());
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/already started/)).toBeVisible();

  // Preferences persist.
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByText(`E2E Parent ${fx.n}`)).toBeVisible();
  await expect(page.getByText(`E2E Attendant ${fx.n}`)).toBeVisible(); // contacts
  const weekly = page.getByRole("switch", { name: /Weekly summary/ });
  await expect(weekly).toHaveAttribute("aria-checked", "false");
  await weekly.click();
  await expect(weekly).toHaveAttribute("aria-checked", "true");
  await page.waitForTimeout(500);
  const me = await data<{ prefs: { digest: boolean } }>(await page.request.get("/api/auth/parent/session"));
  expect(me.prefs.digest).toBe(true);

  // Sign out.
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("button", { name: "Log out" }).last().click();
  await expect(page.getByRole("button", { name: "Send OTP" })).toBeVisible();

  // The seeded demo parent has two children and switches between them.
  await parentSignIn(page, "9848012345");
  await expect(page.getByRole("button", { name: "Aarav" })).toBeVisible();
  await page.getByRole("button", { name: "Diya" }).click();
  await expect(page.getByText("Diya Sharma").first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Diya" })).toHaveAttribute("aria-pressed", "true");

  await ctx.close();
  await crew.dispose();
  await admin.dispose();
});
