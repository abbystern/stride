import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { calendarBackend, owner, otherOwner } from "./support/calendarBackend";
import type { RecoveryEntry } from "../../src/lib/recoveryModel";

test.use({ timezoneId: "America/Los_Angeles" });
test.setTimeout(45_000);
test.beforeEach(async ({ page }) => {
  // UTC is already Nov 4; the user's local date is still Nov 3.
  await page.clock.setFixedTime(new Date("2026-11-04T01:30:00Z"));
});

function entry(overrides: Partial<RecoveryEntry> = {}): RecoveryEntry {
  return { id: randomUUID(), user_id: owner, date: "2026-11-02", sleep_hours: 6.5, energy_rating: 3, soreness_rating: 2, created_at: "2026-11-02T12:00:00Z", ...overrides };
}

async function backend(page: Page, signedIn = true) {
  await calendarBackend(page, signedIn);
  const state = { rows: [] as RecoveryEntry[], writes: 0, missing: false, failSave: false };
  await page.route("**/rest/v1/recovery_entries?*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const send = (status: number, data: unknown, headers = {}) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data), headers });
    if (state.missing) return send(404, { code: "PGRST205", message: "Missing recovery_entries" });
    if (request.method() === "GET") {
      expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
      expect(url.searchParams.get("order")).toContain("date.desc");
      const rows = state.rows.filter((row) => row.user_id === owner).sort((a, b) => b.date.localeCompare(a.date));
      return send(200, rows, { "content-range": `0-${rows.length - 1}/${rows.length}` });
    }
    expect(request.method()).toBe("POST");
    state.writes++;
    if (state.failSave) return send(403, { code: "42501", message: "RLS denied" });
    expect(url.searchParams.get("on_conflict")).toBe("user_id,date");
    const values = request.postDataJSON();
    expect(Object.keys(values).sort()).toEqual(["date", "energy_rating", "sleep_hours", "soreness_rating", "user_id"]);
    expect(values.user_id).toBe(owner);
    expect(values.date).toBe("2026-11-03");
    const existing = state.rows.find((row) => row.user_id === owner && row.date === values.date);
    if (existing) Object.assign(existing, values);
    else state.rows.push(entry(values));
    return send(existing ? 200 : 201, existing ?? state.rows.at(-1));
  });
  return state;
}

async function fill(page: Page, sleep = "7.5", energy = "4", soreness = "2") {
  await page.getByLabel("Sleep (hours)", { exact: true }).fill(sleep);
  await page.getByLabel("Energy (1–5)", { exact: true }).selectOption(energy);
  await page.getByLabel("Soreness (1–5)", { exact: true }).selectOption(soreness);
}

test("recovery: local-date create, refresh, update without duplicate and private history", async ({ page }) => {
  const state = await backend(page);
  const foreign = entry({ user_id: otherOwner, sleep_hours: 23 });
  state.rows.push(entry(), foreign);
  await page.goto("/app");
  await page.getByRole("link", { name: "Recovery", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save Check-In", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Sleep (hours)", { exact: true })).toHaveValue("");
  await expect(page.locator(".recovery-history-row")).toHaveCount(1);
  await fill(page);
  await page.getByRole("button", { name: "Save Check-In", exact: true }).click();
  await expect(page.getByText("Check-in saved.", { exact: true })).toBeVisible();
  await expect(page.locator(".recovery-history-row")).toHaveCount(2);
  const saved = state.rows.find((row) => row.user_id === owner && row.date === "2026-11-03")!;
  const id = saved.id;
  const created = saved.created_at;
  await page.reload();
  await expect(page.getByLabel("Sleep (hours)", { exact: true })).toHaveValue("7.5");
  await expect(page.getByLabel("Energy (1–5)", { exact: true })).toHaveValue("4");
  await expect(page.getByLabel("Soreness (1–5)", { exact: true })).toHaveValue("2");
  await fill(page, "0", "5", "1");
  await page.getByRole("button", { name: "Update Check-In", exact: true }).click();
  await expect(page.getByText("Check-in updated.", { exact: true })).toBeVisible();
  expect(saved).toMatchObject({ id, created_at: created, sleep_hours: 0, energy_rating: 5, soreness_rating: 1 });
  expect(state.rows.filter((row) => row.user_id === owner && row.date === "2026-11-03")).toHaveLength(1);
  expect(foreign.sleep_hours).toBe(23);
  await page.reload();
  await expect(page.getByLabel("Sleep (hours)", { exact: true })).toHaveValue("0");
  expect(await page.locator(".recovery-history-row time").evaluateAll((els) => els.map((el) => el.getAttribute("datetime")))).toEqual(["2026-11-03", "2026-11-02"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("recovery.png"), fullPage: true });
});

test("recovery: required and invalid values never send writes; server errors retain drafts", async ({ page }) => {
  const state = await backend(page);
  await page.goto("/app/recovery");
  const save = page.getByRole("button", { name: "Save Check-In", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByLabel("Sleep (hours)", { exact: true })).toBeFocused();
  await expect(page.getByText("Enter your sleep hours.", { exact: true })).toBeVisible();
  await expect(page.getByText("Choose an energy rating.", { exact: true })).toBeVisible();
  await expect(page.getByText("Choose a soreness rating.", { exact: true })).toBeVisible();
  for (const invalid of ["-1", "24.1"]) {
    await fill(page, invalid);
    await save.click();
    await expect(page.getByText("Sleep must be between 0 and 24 hours.", { exact: true })).toBeVisible();
  }
  expect(state.writes).toBe(0);
  state.failSave = true;
  await fill(page);
  await save.click();
  await expect(page.getByText(/You can only access your own recovery check-ins/)).toBeVisible();
  await expect(page.getByLabel("Sleep (hours)", { exact: true })).toHaveValue("7.5");
  await expect(page.getByText("Check-in saved.", { exact: true })).toHaveCount(0);
  state.failSave = false;
  await save.click();
  await expect(page.getByText("Check-in saved.", { exact: true })).toBeVisible();
});

test("recovery: missing migration is actionable, doesn't assume no check-in, and retries", async ({ page }) => {
  const state = await backend(page);
  state.missing = true;
  state.rows.push(entry({ date: "2026-11-03", sleep_hours: 8 }));
  await page.goto("/app/recovery");
  await expect(page.getByText(/Run migration 007_recovery_checkin.sql/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Check-In", exact: true })).toBeDisabled();
  expect(state.writes).toBe(0);
  state.missing = false;
  await page.getByRole("button", { name: "Retry", exact: true }).first().click();
  await expect(page.getByLabel("Sleep (hours)", { exact: true })).toHaveValue("8");
  await expect(page.getByRole("button", { name: "Update Check-In", exact: true })).toBeEnabled();
});

test("recovery: logged-out visitors cannot open private page", async ({ page }) => {
  const state = await backend(page, false);
  await page.goto("/app/recovery");
  await expect(page.getByRole("heading", { name: "Good to have you back." })).toBeVisible();
  await expect(page.getByLabel("Sleep (hours)", { exact: true })).toHaveCount(0);
  expect(state.writes).toBe(0);
});
