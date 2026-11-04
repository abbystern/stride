import { expect, test } from "@playwright/test";
import { activities, calendarBackend, entry, otherOwner } from "./support/calendarBackend";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T12:00:00Z"));
});

test("calendar: Monday–Sunday navigation, all statuses and activities, owner isolation, details and responsive layout", async ({ page }) => {
  const state = await calendarBackend(page);
  const completed = entry({ title: "Finished run", date: "2026-11-08", status: "completed", distance_miles: 3 });
  state.rows.push(
    entry(), entry({ title: "Midweek run", date: "2026-11-04", status: "in_progress", distance_miles: 2 }), completed,
    ...activities.slice(1).map((activity, index) => entry({ title: activity.name, workout_type_id: activity.id, status: index % 2 ? "completed" : "planned", distance_miles: 99 })),
    entry({ title: "Last week run", date: "2026-11-01", status: "completed", distance_miles: 5 }),
    entry({ title: "Next week run", date: "2026-11-09", distance_miles: 8 }),
    entry({ title: "Private workout", user_id: otherOwner, distance_miles: 999 }),
  );
  await page.goto("/app/calendar");
  await expect(page.getByRole("heading", { name: "Training calendar", exact: true })).toBeVisible();
  await expect(page.locator("section[data-date]")).toHaveCount(7);
  expect(await page.locator("section[data-date]").evaluateAll((days) => days.map((day) => day.getAttribute("data-date"))))
    .toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("6.0");
  await expect(page.getByTestId("completed-mileage")).toHaveText("3.0");
  await expect(page.getByText("Private workout", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-workout-id]').filter({ hasText: "Midweek run" })).toContainText(/in progress/i);
  await expect(page.getByText("No workouts planned for this day.", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("calendar.png"), fullPage: true });
  await page.getByRole("button", { name: "Previous week", exact: true }).click();
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("0.0");
  await expect(page.getByTestId("completed-mileage")).toHaveText("5.0");
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("8.0");
  await page.getByRole("button", { name: "Current week", exact: true }).click();
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("6.0");
  await page.getByRole("link", { name: "Finished run", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/workouts/${completed.id}$`));
  await expect(page.getByRole("heading", { name: "Finished run", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit workout", exact: true }).click();
  await expect(page.getByLabel("Workout title")).toHaveValue("Finished run");
  expect(state.errors).toEqual([]);
});

test("calendar: rescheduling writes date only, persists on reload and moves mileage between weeks", async ({ page }) => {
  const state = await calendarBackend(page);
  const run = entry();
  state.rows.push(run);
  const original = { ...run };
  await page.goto("/app/calendar");
  await page.getByRole("button", { name: `Reschedule ${run.title}`, exact: true }).click();
  await page.getByLabel(`New date for ${run.title}`).fill("2026-11-05");
  await page.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(page.locator('[data-date="2026-11-05"] [data-workout-id]')).toHaveCount(1);
  expect(state.lastPatch).toEqual({ date: "2026-11-05" });
  expect(state.rows[0]).toEqual({ ...original, date: "2026-11-05" });
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("4.0");
  await page.reload();
  await expect(page.locator('[data-date="2026-11-05"] [data-workout-id]')).toHaveCount(1);
  await page.getByRole("button", { name: `Reschedule ${run.title}`, exact: true }).click();
  await page.getByLabel(`New date for ${run.title}`).fill("2026-11-09");
  await page.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("0.0");
  await expect(page.locator("[data-workout-id]")).toHaveCount(0);
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(page.locator('[data-date="2026-11-09"] [data-workout-id]')).toHaveCount(1);
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("4.0");
  expect(state.errors).toEqual([]);
});

test("calendar: invalid and failed reschedules leave the old workout intact and can be retried", async ({ page }) => {
  const state = await calendarBackend(page);
  const run = entry();
  state.rows.push(run);
  state.failMove = true;
  await page.goto("/app/calendar");
  await page.getByRole("button", { name: `Reschedule ${run.title}`, exact: true }).click();
  await page.getByLabel(`New date for ${run.title}`).fill("");
  await page.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(page.getByText("Choose a valid date.", { exact: true })).toBeVisible();
  expect(state.patchCalls).toBe(0);
  await page.getByLabel(`New date for ${run.title}`).fill("2026-11-06");
  await page.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(state.rows[0].date).toBe("2026-11-02");
  await expect(page.locator('[data-date="2026-11-02"] [data-workout-id]')).toHaveCount(1);
  await page.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(page.locator('[data-date="2026-11-06"] [data-workout-id]')).toHaveCount(1);
  expect(state.errors).toEqual([]);
});

test("calendar: adding on a selected day reuses creation form and persists the selected date", async ({ page }) => {
  const state = await calendarBackend(page);
  await page.goto("/app/calendar");
  await page.getByRole("link", { name: "Add workout on 2026-11-08", exact: true }).click();
  await expect(page.getByLabel(/^Date/)).toHaveValue("2026-11-08");
  await page.getByLabel("Workout title").fill("Sunday long run");
  await page.getByLabel(/^Activity/).selectOption(activities[0].id);
  await page.getByLabel("Distance (miles)").fill("7");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/workouts\/[\da-f-]+$/);
  expect(state.rows[0].date).toBe("2026-11-08");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.locator('[data-date="2026-11-08"] [data-workout-id]')).toContainText("Sunday long run");
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("7.0");
  expect(state.errors).toEqual([]);
});

test("calendar: goals are persisted independently by week, accept zero and update instead of duplicating", async ({ page }) => {
  const state = await calendarBackend(page);
  state.goals.push({ id: crypto.randomUUID(), user_id: otherOwner, week_start: "2026-11-02", target_miles: 999 });
  await page.goto("/app/calendar");
  const goal = page.getByLabel("Weekly mileage goal", { exact: true });
  await expect(goal).toBeEnabled();
  await expect(goal).toHaveValue("");
  await goal.fill("25.5");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByText("Weekly goal saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(goal).toHaveValue("");
  await goal.fill("0");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByText("Weekly goal saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous week", exact: true }).click();
  await expect(goal).toHaveValue("25.5");
  await goal.fill("26");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByText("Weekly goal saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(goal).toHaveValue("26");
  expect(state.goals).toHaveLength(3);
  expect(state.goals.find((item) => item.user_id === otherOwner)!.target_miles).toBe(999);
  expect(state.errors).toEqual([]);
});

test("calendar: goal setup and save errors are useful, retryable, and do not block workouts", async ({ page }) => {
  const state = await calendarBackend(page);
  state.rows.push(entry());
  state.missingGoals = true;
  await page.goto("/app/calendar");
  await expect(page.getByRole("alert")).toContainText("004_training_calendar.sql");
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("4.0");
  state.missingGoals = false;
  state.goals.push({ id: crypto.randomUUID(), user_id: "11111111-1111-4111-8111-111111111111", week_start: "2026-11-02", target_miles: 10 });
  await page.getByRole("button", { name: "Retry goal", exact: true }).click();
  const goal = page.getByLabel("Weekly mileage goal", { exact: true });
  await expect(goal).toHaveValue("10");
  await goal.fill("-1");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("zero or more");
  expect(state.goalWriteCalls).toBe(0);
  await goal.fill("12.5");
  state.failGoalSave = true;
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("try again");
  await expect(goal).toHaveValue("12.5");
  expect(state.goals[0].target_miles).toBe(10);
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByText("Weekly goal saved.", { exact: true })).toBeVisible();
  expect(state.goals[0].target_miles).toBe(12.5);
  expect(state.errors).toEqual([]);
});

test("calendar: protected route, invalid query fallback and workout-loading failure", async ({ page }) => {
  const state = await calendarBackend(page, false);
  await page.goto("/app/calendar");
  await expect(page).toHaveURL(/\/login$/);
  expect(state.workoutReadCalls).toBe(0);
  await page.getByLabel("Email address").fill("calendar@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill(crypto.randomUUID());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  state.failRead = true;
  await page.goto("/app/calendar?week=2026-02-30");
  await expect(page).toHaveURL(/week=2026-11-02$/);
  // Supabase retries idempotent 503 reads with backoff before surfacing failure.
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("scheduled-mileage")).toHaveCount(0);
  await expect(page.getByLabel("Scheduled mileage unavailable", { exact: true })).toHaveText("—");
  await expect(page.locator("[data-workout-id]")).toHaveCount(0);
  state.failRead = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("0.0");
  expect(state.errors).toEqual([]);
});

test("calendar: completed reschedules update calendar and dashboard without changing overall mileage", async ({ page }) => {
  const state = await calendarBackend(page);
  const run = entry({ title: "Completed easy run", status: "completed", distance_miles: 3, duration_minutes: 27 });
  state.rows.push(run);
  await page.goto("/app/calendar");
  await expect(page.getByTestId("completed-mileage")).toHaveText("3.0");
  await page.getByRole("button", { name: `Reschedule ${run.title}`, exact: true }).click();
  await page.getByLabel(`New date for ${run.title}`).fill("2026-11-09");
  await page.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(page.getByTestId("completed-mileage")).toHaveText("0.0");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByTestId("weekly-mileage")).toHaveText("0.0");
  await expect(page.getByTestId("average-pace")).toHaveText("—");
  await expect(page.getByTestId("overall-mileage")).toHaveText("3.0");
  await expect(page.getByTestId("overall-average-pace")).toHaveText("9:00/mi");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(page.getByTestId("completed-mileage")).toHaveText("3.0");
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("0.0");
  expect(state.errors).toEqual([]);
});
