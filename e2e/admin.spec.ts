import { expect, test, type Page } from "@playwright/test";
import { adminSignIn, data, manager, masters, uniq } from "./helpers";

/**
 * Every action in the admin console, clicked through the UI as the transport
 * manager, then the role-specific screens as the super admin and the viewer.
 * Records are created with a run-unique suffix and removed again.
 */

test.describe.configure({ mode: "serial" });

const n = uniq();
let page: Page;

const toast = (text: string | RegExp) => page.getByRole("button", { name: text }).last();
/** Text in the page body, ignoring the dialog and the toast. */
const onPage = (text: string) => page.getByRole("main").getByText(text, { exact: true }).first();
const dialog = () => page.getByRole("dialog");

async function fill(label: string, value: string) {
  await dialog().getByLabel(label, { exact: true }).fill(value);
}
async function pick(label: string, option: string) {
  await dialog().getByLabel(label, { exact: true }).selectOption({ label: option });
}
async function save(entity: string) {
  await dialog().getByRole("button", { name: `Save ${entity}` }).click();
  await expect(dialog()).toBeHidden();
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("dialog", (d) => void d.accept(d.type() === "prompt" ? "E2E check" : undefined));
  await adminSignIn(page, "transport", "demo1234");
});

test.afterAll(async () => {
  await page.close();
});

test("buses: create, edit, document upload and delete", async () => {
  await page.goto("/admin/buses");
  await page.getByRole("button", { name: "Add bus" }).click();
  await fill("Bus number", `U${n.slice(-4)}`);
  await fill("Registration number", `TS 09 UI ${n}`);
  await fill("Capacity", "40");
  await pick("Route", "Kukatpally → School");
  await save("bus");
  await expect(toast(`Bus U${n.slice(-4)} saved.`)).toBeVisible();
  await expect(page.getByText(`TS 09 UI ${n}`)).toBeVisible();

  // Validation lands under the field.
  await page.getByRole("button", { name: `Edit Bus U${n.slice(-4)}` }).click();
  await fill("Capacity", "0");
  await dialog().getByRole("button", { name: "Save bus" }).click();
  await expect(dialog().getByText("Capacity must be at least 1.", { exact: true })).toBeVisible();
  await fill("Capacity", "36");
  await save("bus");

  // Compliance document: upload, download, remove.
  await page.goto(`/admin/buses/U${n.slice(-4)}`);
  await page.getByRole("button", { name: "Documents" }).click();
  await page.locator("input[type=file]").first().setInputFiles({ name: "rc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
  await expect(toast("rc.pdf uploaded.")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download Registration certificate/ }).click();
  expect((await download).suggestedFilename()).toBe("rc.pdf");
  await page.getByRole("button", { name: /Remove Registration certificate/ }).click();
  await expect(toast("Document removed.")).toBeVisible();

  await page.goto("/admin/buses");
  await page.getByRole("button", { name: `Delete Bus U${n.slice(-4)}` }).click();
  await dialog().getByRole("button", { name: "Delete bus" }).click();
  await expect(page.getByRole("main").getByText(`TS 09 UI ${n}`, { exact: true })).toHaveCount(0);
});

test("drivers and attendants: create (with PIN), reset PIN, delete", async () => {
  await page.goto("/admin/drivers");
  await page.getByRole("button", { name: "Add driver" }).click();
  await fill("Full name", `UI Driver ${n}`);
  await fill("Mobile", "9876543210");
  await fill("Licence number", `TS02UI${n}`);
  await fill("Licence expiry", "14 Mar 2031");
  await save("driver");
  await expect(toast(/UI Driver .* saved\. Crew ID GF-DRV-\d{4}, first PIN \d{4}\./)).toBeVisible();
  await page.getByRole("button", { name: `Delete UI Driver ${n}` }).click();
  await dialog().getByRole("button", { name: "Delete driver" }).click();
  await expect(page.getByRole("main").getByText(`UI Driver ${n}`, { exact: true })).toHaveCount(0);

  await page.goto("/admin/attendants");
  await page.getByRole("button", { name: "Add attendant" }).click();
  await fill("Full name", `UI Attendant ${n}`);
  await fill("Mobile", "9876543211");
  await save("attendant");
  await expect(toast(/first PIN \d{4}/)).toBeVisible();
  await page.getByRole("button", { name: `Edit UI Attendant ${n}` }).click();
  await fill("Full name", `UI Attendant ${n} B`);
  await save("attendant");
  await expect(onPage(`UI Attendant ${n} B`)).toBeVisible();
  await page.getByRole("button", { name: `Delete UI Attendant ${n} B` }).click();
  await dialog().getByRole("button", { name: "Delete attendant" }).click();
  await expect(page.getByRole("main").getByText(`UI Attendant ${n} B`, { exact: true })).toHaveCount(0);
});

test("students and stops: create, assign at a stop, delete", async () => {
  await page.goto("/admin/students");
  await page.getByRole("button", { name: "Add student" }).click();
  await fill("Full name", `UI Student ${n}`);
  await fill("Class and section", "Grade 2 · C");
  await pick("Assigned bus", "Bus 17");
  await pick("Route", "Kukatpally → School");
  await fill("Parent name", `UI Parent ${n}`);
  await fill("Parent mobile", "9811122233");
  await save("student");
  await expect(onPage(`UI Student ${n}`)).toBeVisible();

  await page.goto("/admin/stops");
  await page.getByRole("button", { name: "Add stop" }).click();
  await fill("Stop name", `UI Stop ${n}`);
  await pick("Route", "Kukatpally → School");
  await fill("Pickup time", "7:40 AM");
  await fill("Drop time", "4:05 PM");
  await fill("Landmark", "E2E landmark");
  await dialog().getByLabel("Search students").fill(`UI Student ${n}`);
  await dialog().getByText(`UI Student ${n}`).click();
  await save("stop");
  await expect(onPage(`UI Stop ${n}`)).toBeVisible();

  const m = await masters(await manager());
  expect(m.students.find((s) => s.name === `UI Student ${n}`)?.stop).toBe(`UI Stop ${n}`);

  await page.getByRole("button", { name: `Delete UI Stop ${n}` }).click();
  await dialog().getByRole("button", { name: "Delete stop" }).click();
  await expect(page.getByRole("main").getByText(`UI Stop ${n}`, { exact: true })).toHaveCount(0);

  await page.goto("/admin/students");
  await page.getByRole("button", { name: `Delete UI Student ${n}` }).click();
  await dialog().getByRole("button", { name: "Delete student" }).click();
  await expect(page.getByRole("main").getByText(`UI Student ${n}`, { exact: true })).toHaveCount(0);
});

test("routes: create with stops, reorder, delete", async () => {
  await page.goto("/admin/routes");
  await page.getByRole("button", { name: "Add route" }).click();
  await fill("Route name", `UI Route ${n}`);
  await fill("Zone", "E2E");
  await dialog().getByLabel("Stop 1", { exact: true }).selectOption({ label: "Lanco Hills" });
  await dialog().getByLabel("Pickup time for stop 1").fill("7:10 AM");
  await dialog().getByLabel("Drop time for stop 1").fill("4:30 PM");
  await dialog().getByRole("button", { name: "Blank row" }).click();
  await dialog().getByLabel("Stop 2", { exact: true }).selectOption({ label: "Miyapur X Roads" });
  await dialog().getByLabel("Pickup time for stop 2").fill("7:30 AM");
  await dialog().getByLabel("Drop time for stop 2").fill("4:10 PM");
  await save("route");
  await expect(onPage(`UI Route ${n}`)).toBeVisible();

  await onPage(`UI Route ${n}`).click();
  await expect(page.getByText("Stop sequence", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Move Miyapur X Roads earlier" }).click();
  await expect(page.getByRole("button", { name: "Move Miyapur X Roads earlier" })).toBeDisabled();
  const m = await masters(await manager());
  const route = m.routes.find((r) => r.name === `UI Route ${n}`)!;
  expect(m.stops.find((s) => s.name === "Miyapur X Roads")!.onRoutes[route.id]!.seq).toBe(1);

  await page.goto("/admin/routes");
  await page.getByRole("button", { name: `Delete UI Route ${n}` }).click();
  await dialog().getByRole("button", { name: "Delete route" }).click();
  await expect(page.getByRole("main").getByText(`UI Route ${n}`, { exact: true })).toHaveCount(0);
});

test("school trips: create with a bus, manifest, consent, status", async () => {
  await page.goto("/admin/school-trips");
  await page.getByRole("button", { name: "New school trip" }).click();
  await fill("Trip name", `UI Trip ${n}`);
  await fill("Destination", "Salar Jung Museum");
  await fill("Date", "20 December 2026");
  await fill("Departure time", "9:00 AM");
  await fill("Expected return", "2:00 PM");
  await fill("Teacher in charge", "Meera Krishnan");
  await dialog().getByLabel("Bus for row 1").selectOption({ label: "Bus 21" });
  await dialog().getByLabel("Students for row 1").fill("30");
  await save("school trip");
  await onPage(`UI Trip ${n}`).click();

  await page.getByRole("button", { name: "Add or remove students" }).click();
  await page.getByLabel("Search students").fill("Ananya");
  await page.getByText("Ananya Patel", { exact: true }).click();
  await expect(page.getByText("Consent pending", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark departed" }).click();
  await expect(toast(/no parent consent/)).toBeVisible();
  await page.getByText("Consent pending", { exact: true }).click();
  await expect(page.getByText("Consent received", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark departed" }).click();
  await expect(page.getByRole("button", { name: "Mark arrived at venue" })).toBeVisible();
});

test("attendance: live tally, correction, absence notice, exports", async () => {
  await page.goto("/admin/attendance");
  await expect(page.getByText("Expected", { exact: true })).toBeVisible();
  await expect(page.locator("text=—").first()).toBeHidden({ timeout: 15_000 }).catch(() => undefined);

  // Office correction for Myra (prompt answered by the dialog handler).
  const row = page.locator("tr", { hasText: "Myra Nair" });
  await row.getByLabel("Correct attendance for Myra Nair").selectOption("morning:Boarded");
  await expect(toast(/Attendance corrected/)).toBeVisible();
  await expect(row.locator("td").nth(3)).toContainText("Boarded");
  const m = await masters(await manager());
  expect(m.students.find((x) => x.name === "Myra Nair")?.am).toBe("Boarded");

  const ack = page.getByRole("button", { name: "Acknowledge" }).first();
  if (await ack.isVisible()) {
    await ack.click();
    await expect(page.getByText("Seen", { exact: true }).first()).toBeVisible();
  }

  const csv = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  expect((await csv).suggestedFilename()).toMatch(/^attendance-.*\.csv$/);

  await page.goto("/admin/attendance/history");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.getByRole("button", { name: "Last 30 days" }).click();

  await page.goto("/admin/analytics/reports");
  for (const name of ["Attendance register", "Trip performance", "Safety incidents"]) {
    const dl = page.waitForEvent("download");
    await page.locator("div", { hasText: name }).getByRole("link", { name: "Download CSV" }).last().click();
    expect((await dl).suggestedFilename()).toMatch(/\.csv$/);
  }
});

test("incidents: log, note, move through the workflow", async () => {
  await page.goto("/admin/incidents");
  await page.getByRole("button", { name: "Log incident" }).click();
  await page.getByLabel("Bus", { exact: true }).selectOption({ label: "Bus 21" });
  await page.getByLabel("Type", { exact: true }).fill(`UI incident ${n}`);
  await page.getByLabel("Severity", { exact: true }).selectOption("HIGH");
  await page.getByLabel("Description", { exact: true }).fill("Raised by the end-to-end suite.");
  await page.getByRole("button", { name: "Save incident" }).click();
  await expect(onPage(`UI incident ${n}`)).toBeVisible();

  await page.getByLabel("Note").fill("Driver called, all fine.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Driver called, all fine.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Move to under review" }).click();
  await page.getByRole("button", { name: "Move to investigating" }).click();
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await page.getByRole("button", { name: "Close incident" }).click();
  await expect(page.getByText(/^Status: closed/)).toBeVisible();
  await expect(page.getByText("Closed", { exact: true }).first()).toBeVisible();
});

test("CCTV: open a camera, change health, raise ticket", async () => {
  await page.goto("/admin/cctv");
  await page.getByRole("button", { name: "Open Bus 21 Cabin camera" }).click();
  await expect(toast(/This view was logged/)).toBeVisible();

  // Bus 12's LivePin dashcam opens the vendor player (or says the camera is off).
  await page.getByRole("button", { name: "Open Bus 12 Channel 1 camera" }).click();
  const viewer = page.getByRole("dialog", { name: /Bus 12 live camera/ });
  await expect(viewer.locator("iframe").or(viewer.getByText(/not reachable|unavailable|did not answer/))).toBeVisible({ timeout: 30_000 });
  await viewer.getByRole("button", { name: "Close" }).click();

  await page.goto("/admin/cctv/health");
  const sel = page.getByLabel("Status of Bus 17 Cabin camera");
  await sel.selectOption("ONLINE");
  await expect(sel).toHaveValue("ONLINE");
  await sel.selectOption("RECORDING_ISSUE");
  await page.locator("div", { hasText: /^Bus 17/ }).getByRole("button", { name: "Raise ticket" }).first().click();
  await expect(toast(/Support ticket raised for Bus 17/)).toBeVisible();

});

test("bus 12 tracker: health, live readings, history, alerts, form", async () => {
  await page.goto("/admin/buses/12");
  await expect(page.getByText("Tracker health", { exact: true })).toBeVisible();
  await expect(page.getByText("Tracker settings", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Live Trip", exact: true }).click();
  await expect(page.getByText("Live readings", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^ALARMS · \d+ FLAGS FROM THE TRACKER$/)).toBeVisible();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByLabel("Day").fill("2026-10-15");
  await expect(page.getByText(/Route replay/)).toBeVisible();
  await expect(page.getByText("Day timeline", { exact: true }).or(page.getByText(/No report from the tracker/))).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Alerts", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Alert" })).toBeVisible();

  // The bus form carries the GPS & camera section with the tracker preselected.
  await page.goto("/admin/buses");
  await page.getByRole("button", { name: "Edit Bus 12" }).click();
  await expect(dialog().getByText(/GPS & camera$/)).toBeVisible();
  await expect(dialog().getByLabel("Tracker")).toHaveValue(/\d+/, { timeout: 30_000 });
  await expect(dialog().getByLabel("Overspeed limit (km/h)")).toBeVisible();
  await dialog().getByRole("button", { name: "Cancel" }).click();
});

test("settings: change and save, then restore", async () => {
  await page.goto("/admin/settings");
  const field = page.getByLabel("Undo window (minutes)");
  await expect(field).toHaveValue(/\d+/);
  const before = await field.inputValue();
  await field.fill("12");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(toast("Settings saved.")).toBeVisible();
  const admin = await manager();
  const saved = await data<{ settings: { undoWindowMin: number } }>(await admin.get("/api/admin/settings"));
  expect(saved.settings.undoWindowMin).toBe(12);
  await field.fill(before);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(toast("Settings saved.")).toBeVisible();
});

test("sign out returns to the sign-in screen", async () => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: /Sign out/ }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("super admin manages staff; viewer is read-only", async ({ browser }) => {
  const sup = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await adminSignIn(sup, "principal", "demo1234");
  await sup.goto("/admin/settings");
  await sup.getByLabel("Name", { exact: true }).fill(`UI Clerk ${n}`);
  await sup.getByLabel("Username", { exact: true }).fill(`clerk${n}`);
  await sup.getByLabel("Password", { exact: true }).fill("clerk-pass-2026");
  await sup.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sup.getByText(`signs in as clerk${n}.`)).toBeVisible();
  await expect(sup.getByText(`clerk${n}`, { exact: true })).toBeVisible();
  await sup.locator("div", { hasText: `clerk${n}` }).getByRole("button", { name: "Reset password" }).last().click();
  await expect(sup.getByText(new RegExp(`New password for clerk${n}: \\S+`))).toBeVisible();
  await sup.locator("div", { hasText: `clerk${n}` }).getByRole("button", { name: "Deactivate" }).last().click();
  await expect(sup.getByText(/can no longer sign in/)).toBeVisible();
  await sup.close();

  const view = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await adminSignIn(view, "office", "demo1234");
  await view.goto("/admin/buses");
  await view.getByRole("button", { name: "Add bus" }).click();
  await expect(view.getByText(/Your role can view but not change records/)).toBeVisible();
  await expect(view.getByRole("dialog")).toBeHidden();
  await view.goto("/admin/attendance");
  await expect(view.getByLabel(/Correct attendance/)).toHaveCount(0);
  await view.close();
});
