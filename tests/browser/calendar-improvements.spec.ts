import { expect, test, type Page } from "@playwright/test";
import { activities, calendarBackend, entry, otherOwner } from "./support/calendarBackend";

test.use({ timezoneId: "America/Los_Angeles" });
test.setTimeout(60000);
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-11-04T12:00:00Z")); });
const day = (page: Page, date: string) => page.locator(`[data-date="${date}"]`);
const submit = (page: Page) => page.locator('form button[type="submit"]');
const startTime = (page: Page) => page.getByLabel("Start time (optional)", { exact: true });

test("calendar mileage: saved distances appear in both views without changing running-only totals", async ({ page }) => {
  const state = await calendarBackend(page);
  const rows = [
    entry({ title: "Easy run", date: "2026-11-04", distance_miles: 3.5 }),
    entry({ title: "Zero distance", date: "2026-11-04", distance_miles: 0 }),
    entry({ title: "Walk", date: "2026-11-04", workout_type_id: activities.find((type) => type.name === "Walking")!.id, distance_miles: 2 }),
    entry({ title: "Lifting", date: "2026-11-04", workout_type_id: activities.find((type) => type.name === "Strength Training")!.id, distance_miles: null }),
    entry({ title: "Rest", date: "2026-11-04", workout_type_id: activities.find((type) => type.name === "Rest Day")!.id, distance_miles: null }),
  ];
  state.rows.push(...rows);
  await page.goto("/app/calendar?week=2026-11-02");
  for (const view of ["Week", "Month"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    const cards = rows.map((row) => page.locator(`[data-workout-id="${row.id}"]`));
    await expect(cards[0].locator(".calendar-workout-distance")).toHaveText("3.5 mi");
    await expect(cards[1].locator(".calendar-workout-distance")).toHaveText("0 mi");
    await expect(cards[2].locator(".calendar-workout-distance")).toHaveText("2 mi");
    await expect(cards[3].locator(".calendar-workout-distance")).toHaveCount(0);
    await expect(cards[4].locator(".calendar-workout-distance")).toHaveCount(0);
    await expect(page.getByTestId("scheduled-mileage")).toHaveText("3.5");
    await expect(page.getByTestId("completed-mileage")).toHaveText("0.0");
  }
  await page.getByRole("button", { name: "Week", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("calendar-mileage.png"), fullPage: true });
  expect(state.errors).toEqual([]);
});

test("calendar improvements: weekly/monthly grid placements, ordered times, goals and navigation", async ({ page }) => {
  const state = await calendarBackend(page);
  const completed = entry({ date: "2026-11-04", title: "Morning five", status: "completed", distance_miles: 5, scheduled_start_time: "06:30:00" });
  const planned = entry({ date: completed.date, title: "Evening three", distance_miles: 3, scheduled_start_time: "18:15:00" });
  const rest = entry({ date: completed.date, title: "Quiet recovery", workout_type_id: activities.find((type) => type.name === "Rest Day")!.id, distance_miles: null, duration_minutes: null, run_type: null });
  state.rows.push(completed, planned, rest, entry({ date: "2026-11-16", title: "Later week", status: "completed", distance_miles: 10 }),
    entry({ user_id: otherOwner, title: "Private other account", date: completed.date }));
  await page.goto("/app/calendar?week=2026-11-02");
  await expect(page.locator(".calendar-day")).toHaveCount(7);
  await expect(day(page, completed.date).getByRole("link", { name: completed.title, exact: true })).toBeVisible();
  await expect(day(page, completed.date)).toContainText("6:30 AM");
  await expect(day(page, completed.date)).toContainText("6:15 PM");
  await expect(day(page, completed.date)).toContainText("No time set");
  expect(await day(page, completed.date).locator("[data-workout-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-workout-id")))).toEqual([completed.id, planned.id, rest.id]);
  await expect(page.getByText("Private other account", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("3.0");
  await expect(page.getByTestId("completed-mileage")).toHaveText("5.0");
  await page.getByLabel("Weekly mileage goal", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByText(/goal saved/i)).toBeVisible();
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(page).toHaveURL(/week=2026-11-09/);
  await expect(page.getByRole("link", { name: completed.title, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Previous week", exact: true }).click();
  await expect(page.getByLabel("Weekly mileage goal", { exact: true })).toHaveValue("20");
  await page.getByRole("button", { name: "Current week", exact: true }).click();
  await expect(page).toHaveURL(/week=2026-11-02/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("calendar-week.png"), fullPage: true });
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.locator(".calendar-day")).toHaveCount(42);
  await day(page, "2026-11-16").getByRole("button", { name: /Select/ }).click();
  await expect(page.getByTestId("completed-mileage")).toHaveText("10.0");
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(page).toHaveURL(/week=2026-12-01/);
  await page.getByRole("button", { name: "Previous month", exact: true }).click();
  await expect(page).toHaveURL(/week=2026-11-01/);
  await day(page, completed.date).getByRole("button", { name: /Select/ }).click();
  await expect(page.getByLabel("Weekly mileage goal", { exact: true })).toHaveValue("20");
  await page.reload();
  await expect(page.getByTestId("completed-mileage")).toHaveText("5.0");
  expect(state.errors).toEqual([]);
});

test("calendar improvements: rest days support create, timed edit, move, refresh and confirmed delete", async ({ page }) => {
  const state = await calendarBackend(page);
  await page.goto("/app/calendar?week=2026-11-02");
  await day(page, "2026-11-04").getByRole("link", { name: /Add rest day/i }).click();
  await expect(page.locator("#date")).toHaveValue("2026-11-04");
  await expect(page.locator("#title")).toHaveValue("Rest Day");
  await startTime(page).fill("00:15");
  await page.getByLabel("Notes", { exact: true }).fill("Recovery and sleep");
  await expect(page.getByLabel("Distance (miles)", { exact: true })).toHaveCount(0);
  await submit(page).click();
  await expect(page).toHaveURL(/\/app\/workouts\/[\da-f-]+$/);
  const id = state.rows[0].id;
  await expect(page.getByText(/12:15 AM/)).toBeVisible();
  expect(state.rows[0].distance_miles).toBeNull();
  await page.getByRole("link", { name: "Edit workout", exact: true }).click();
  await startTime(page).fill("23:45");
  await page.locator("#status").selectOption("completed");
  await page.getByLabel("Notes", { exact: true }).fill("Rested well");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`/app/workouts/${id}$`));
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByRole("button", { name: "Reschedule Rest Day", exact: true }).click();
  await page.getByLabel("New date for Rest Day", { exact: true }).fill("2026-11-06");
  await page.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(day(page, "2026-11-06").getByRole("link", { name: "Rest Day", exact: true })).toBeVisible();
  expect(state.lastPatch).toEqual({ date: "2026-11-06" });
  await page.reload();
  await expect(day(page, "2026-11-06")).toContainText("11:45 PM");
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("0.0");
  await expect(page.getByTestId("completed-mileage")).toHaveText("0.0");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByTestId("completed-workouts")).toHaveText("0");
  await expect(page.getByTestId("overall-completed-workouts")).toHaveText("0");
  await expect(page.getByTestId("average-pace")).toHaveText("—");
  await page.goto(`/app/workouts/${id}`);
  await expect(page.getByText("Rested well", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete workout", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/workouts$/);
  expect(state.rows).toHaveLength(0);
  expect(state.errors).toEqual([]);
});

test("calendar improvements: regular workouts save, edit and clear local start times without date shifts", async ({ page }) => {
  const state = await calendarBackend(page);
  await page.goto("/app/calendar?week=2026-11-02");
  await day(page, "2026-11-05").getByRole("link", { name: /Add workout/i }).click();
  await page.locator("#title").fill("Dawn run");
  await page.locator("#workout_type_id").selectOption(activities[0].id);
  await startTime(page).fill("06:30");
  await page.getByLabel("Distance (miles)", { exact: true }).fill("4");
  await submit(page).click();
  await expect(page).toHaveURL(/\/app\/workouts\/[\da-f-]+$/);
  const id = state.rows[0].id;
  expect(state.rows[0].date).toBe("2026-11-05");
  await page.getByRole("link", { name: "Edit workout", exact: true }).click();
  await expect(startTime(page)).toHaveValue("06:30");
  await startTime(page).fill("18:00");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`/app/workouts/${id}$`));
  await page.reload();
  await expect(page.getByText(/6:00 PM/)).toBeVisible();
  await page.getByRole("link", { name: "Edit workout", exact: true }).click();
  await startTime(page).fill("");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`/app/workouts/${id}$`));
  await expect(page.getByText(/No time set/)).toBeVisible();
  expect(state.rows[0].scheduled_start_time).toBeNull();
  expect(state.rows[0].date).toBe("2026-11-05");
  expect(state.errors).toEqual([]);
});

test("calendar improvements: missing migration is actionable without breaking old untimed workouts", async ({ page }) => {
  const state = await calendarBackend(page);
  state.missingTimes = true;
  state.missingRest = true;
  const row = entry({ title: "Legacy run", date: "2026-11-04" });
  state.rows.push(row);
  await page.goto("/app/calendar?week=2026-11-02");
  await expect(day(page, row.date)).toContainText("No time set");
  await day(page, row.date).getByRole("link", { name: /Add rest day/i }).click();
  await expect(page.getByRole("alert")).toContainText("migration 006");
  await page.goto(`/app/workouts/${row.id}/edit`);
  await page.locator("#title").fill("Legacy updated");
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`/app/workouts/${row.id}$`));
  expect(state.lastPatch).not.toHaveProperty("scheduled_start_time");
  await page.getByRole("link", { name: "Edit workout", exact: true }).click();
  await startTime(page).fill("06:30");
  await submit(page).click();
  await expect(page.getByRole("alert")).toContainText("006_calendar_improvements.sql");
  await expect(startTime(page)).toHaveValue("06:30");
  expect(state.errors).toEqual([]);
});
