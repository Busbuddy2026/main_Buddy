import { expect, test } from "@playwright/test";
import { crewSignIn, data, makeBus, manager, masters } from "./helpers";

/**
 * The crew app, through its screens: the attendant runs a full morning trip
 * (marks, undo, SOS raised and cancelled) and the evening trip; the driver
 * signs in to the same bus. A fresh bus, crew and student are made per run.
 */

test("attendant runs both trips; driver signs in to the same bus", async ({ browser }) => {
  test.setTimeout(150_000);
  const admin = await manager();
  const fx = await makeBus(admin);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const card = () => page.locator("div.rounded-\\[18px\\]", { hasText: fx.childName });

  // ── Sign in (attendant) ────────────────────────────────────────────────
  await crewSignIn(page, fx.attendant.crewId, "0000");
  await expect(page.getByText(/did not match/)).toBeVisible(); // a wrong PIN is refused
  await page.getByLabel("4-digit PIN").fill(fx.attendant.pin);
  await expect(page.getByText(`BUS ${fx.number}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`E2E Attendant ${fx.n} · Bus crew`)).toBeVisible();

  // ── Morning ────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "START TRIP" }).click();
  await expect(page.getByText("CURRENT STOP", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next stop" }).click(); // Kondapur has nobody
  await expect(page.getByText("Botanical Garden", { exact: true }).first()).toBeVisible();

  await card().getByRole("button", { name: "Absent" }).click();
  await expect(card().getByText(/Marked absent at Botanical/)).toBeVisible();
  await card().getByRole("button", { name: "Undo" }).click();
  await card().getByRole("button", { name: "Boarded" }).click();
  await expect(card().getByText(/Boarded at Botanical/)).toBeVisible();
  await expect(page.getByText("All marks sent")).toBeVisible();

  // SOS: confirm, then cancel.
  await page.getByRole("button", { name: "SOS", exact: true }).click();
  await page.getByRole("button", { name: "Send emergency alert" }).click();
  await expect(page.getByText("Emergency alert sent")).toBeVisible();
  await expect(page.getByText("All marks sent")).toBeVisible();
  const raised = await data<{ items: Array<{ type: string; bus: string; status: { label: string } }> }>(await admin.get("/api/admin/incidents"));
  expect(raised.items.find((i) => i.type === "SOS" && i.bus === `Bus ${fx.number}`)?.status.label).toBe("New");
  await page.getByRole("button", { name: "Cancel alert" }).click();
  await expect(page.getByText("Emergency alert sent")).toBeHidden();
  await expect(page.getByText("All marks sent")).toBeVisible();

  // Logging out mid-trip is blocked.
  await page.goto("/crew/profile");
  await expect(page.getByRole("button", { name: "Log out" })).toBeDisabled();
  await page.goto("/crew/stop");

  while (await page.getByRole("button", { name: "Next stop" }).isVisible()) {
    await page.getByRole("button", { name: "Next stop" }).click();
  }
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { name: "Trip summary" })).toBeVisible();
  await page.getByRole("button", { name: /COMPLETE MORNING TRIP/ }).click();
  await expect(page.getByRole("button", { name: "MORNING TRIP COMPLETED" })).toBeVisible();
  await expect(page.getByText("All marks sent")).toBeVisible();

  let seen = await masters(admin);
  expect(seen.students.find((s) => s.name === fx.childName)?.am).toBe("Dropped"); // reached school

  // ── Evening ────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "evening", exact: true }).click();
  await page.getByRole("button", { name: "START TRIP" }).click();
  await expect(page.getByText("BOARDING AT", { exact: true })).toBeVisible();
  await card().getByRole("button", { name: "Boarded" }).click();
  await expect(card().getByText(/Boarded at School/)).toBeVisible();
  await page.getByRole("button", { name: "Next stop" }).click(); // Gachibowli
  await page.getByRole("button", { name: "Next stop" }).click(); // Green Valley
  await page.getByRole("button", { name: "Next stop" }).click(); // Botanical
  await card().getByRole("button", { name: "Mark dropped" }).click();
  await expect(card().getByText(/Dropped at Botanical/)).toBeVisible();
  await page.getByRole("button", { name: "Next stop" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: /COMPLETE EVENING TRIP/ }).click();
  await expect(page.getByRole("button", { name: "EVENING TRIP COMPLETED" })).toBeVisible();
  await expect(page.getByText("All marks sent")).toBeVisible();

  seen = await masters(admin);
  expect(seen.students.find((s) => s.name === fx.childName)?.pm).toBe("Dropped");

  // Profile shows real records; logging out works after the trip.
  await page.goto("/crew/profile");
  await expect(page.getByText(fx.attendant.crewId)).toBeVisible();
  await expect(page.getByText("Police verification")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("button", { name: "Log out" }).last().click();
  await expect(page.getByRole("heading", { name: "Crew sign in" })).toBeVisible();

  // ── Driver ─────────────────────────────────────────────────────────────
  await crewSignIn(page, fx.driver.crewId, fx.driver.pin);
  await expect(page.getByText(`BUS ${fx.number}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`E2E Driver ${fx.n} · Bus crew`)).toBeVisible();
  await expect(page.getByText(`E2E Attendant ${fx.n}`)).toBeVisible(); // partner card

  await ctx.close();
  await admin.dispose();
});
