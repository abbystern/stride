import { expect, test, type Page } from "@playwright/test";
import { strengthBackend } from "./support/strengthBackend";
import { activities, entry } from "./support/calendarBackend";

async function createTemplate(page: Page, name = "Upper A") {
  await page.goto("/app/strength");
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await page.getByLabel("Template name", { exact: true }).fill(name);
  await page.getByLabel("Exercise name", { exact: true }).fill("Chest Press");
  await page.getByLabel("Sets", { exact: true }).fill("2");
  await page.getByLabel("Notes (optional)", { exact: true }).fill("Controlled tempo");
  await page.getByRole("button", { name: "Save template", exact: true }).click();
  await expect(page.getByRole("button", { name: `Start ${name}`, exact: true })).toBeVisible();
}
async function logSet(page: Page, weight = "65", reps = "10") {
  await page.getByLabel("Chest Press set 1 weight", { exact: true }).fill(weight);
  await page.getByLabel("Chest Press set 1 reps", { exact: true }).fill(reps);
  await page.getByLabel("Chest Press set 1 completed", { exact: true }).check();
}
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-11-04T12:00:00Z")); });

test("strength: create/edit ordered reusable templates and initialize independent session snapshots", async ({ page }) => {
  const state = await strengthBackend(page);
  await createTemplate(page);
  await page.getByRole("button", { name: "Edit Upper A", exact: true }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.getByLabel("Exercise name", { exact: true }).nth(1).fill("Row");
  await page.getByRole("button", { name: /move.*up/i }).last().click();
  await page.getByRole("button", { name: "Save template", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start Upper A", exact: true })).toBeVisible();
  expect(state.templates[0].template_exercises.map((item) => item.exercise.name)).toEqual(["Row", "Chest Press"]);
  await page.getByRole("button", { name: "Start Upper A", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/workouts\/[\da-f-]+\/strength$/);
  await expect(page.getByLabel("Chest Press set 1 weight", { exact: true })).toBeVisible();
  expect(state.rows).toHaveLength(1);
  expect(state.sets).toHaveLength(5);
  const originalTargets = state.sets.map((set) => set.target_sets);
  await page.getByRole("link", { name: "Strength", exact: true }).click();
  await page.getByRole("button", { name: "Edit Upper A", exact: true }).click();
  await page.getByLabel("Sets", { exact: true }).first().fill("4");
  await page.getByRole("button", { name: "Save template", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start Upper A", exact: true })).toBeVisible();
  expect(state.sets.map((set) => set.target_sets)).toEqual(originalTargets);
  expect(state.errors).toEqual([]);
});

test("strength: saved weights/reps survive refresh; finish results and prior performance match completed sets", async ({ page }) => {
  const state = await strengthBackend(page);
  await createTemplate(page);
  await page.getByLabel("Workout date", { exact: true }).fill("2026-11-03");
  await page.getByRole("button", { name: "Start Upper A", exact: true }).click();
  await logSet(page);
  await page.getByRole("button", { name: "Save progress", exact: true }).click();
  await expect(page.getByText("Progress saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Chest Press set 1 weight", { exact: true })).toHaveValue("65");
  await expect(page.getByLabel("Chest Press set 1 reps", { exact: true })).toHaveValue("10");
  await expect(page.getByLabel("Chest Press set 1 completed", { exact: true })).toBeChecked();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await expect(page.getByText(/completed results/i).first()).toBeVisible();
  expect(state.rows[0].status).toBe("completed");
  await page.reload();
  await expect(page.getByRole("button", { name: "Save progress", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Strength", exact: true }).click();
  await page.getByRole("button", { name: "Start Upper A", exact: true }).click();
  await expect(page.getByText(/65.*10/).first()).toBeVisible();
  expect(state.sets.filter((set) => set.completed)).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("strength-session.png"), fullPage: true });
  await page.getByRole("link", { name: /workout details/i }).first().click();
  await expect(page.getByRole("link", { name: "Track strength workout", exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test("strength: invalid entries and failed writes retain drafts and never claim saved progress", async ({ page }) => {
  const state = await strengthBackend(page);
  await createTemplate(page);
  await page.getByRole("button", { name: "Start Upper A", exact: true }).click();
  await logSet(page, "-1");
  await page.getByRole("button", { name: "Save progress", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/nonnegative/i);
  await page.getByLabel("Chest Press set 1 weight", { exact: true }).fill("67.5");
  state.failWrite = true;
  await page.getByRole("button", { name: "Save progress", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/try again/i);
  await expect(page.getByLabel("Chest Press set 1 weight", { exact: true })).toHaveValue("67.5");
  expect(state.sets[0].weight_lbs).toBeNull();
  await page.getByRole("button", { name: "Save progress", exact: true }).click();
  await expect(page.getByText("Progress saved.", { exact: true })).toBeVisible();
  expect(state.sets[0].weight_lbs).toBe(67.5);
  expect(state.errors).toEqual([]);
});

test("strength: apply a routine to an existing scheduled workout without replacing its identity", async ({ page }) => {
  const state = await strengthBackend(page);
  await createTemplate(page);
  const scheduled = entry({ title: "Scheduled gym day", date: "2026-11-08", workout_type_id: activities.find((item) => item.name === "Strength Training")!.id });
  state.rows.push(scheduled);
  await page.goto(`/app/workouts/${scheduled.id}`);
  await page.getByRole("link", { name: "Track strength workout", exact: true }).click();
  await page.getByLabel("Strength template", { exact: true }).selectOption(state.templates[0].id);
  await page.getByRole("button", { name: "Use template", exact: true }).click();
  await logSet(page, "0", "8");
  await page.getByRole("button", { name: "Save progress", exact: true }).click();
  await expect(page.getByText("Progress saved.", { exact: true })).toBeVisible();
  expect(state.rows).toHaveLength(1);
  expect(state.rows[0].date).toBe("2026-11-08");
  expect(state.rows[0].title).toBe("Scheduled gym day");
  expect(state.rows[0].notes).toBe("Preserve these notes");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.getByTestId("scheduled-mileage")).toHaveText("0.0");
  await expect(page.getByTestId("completed-mileage")).toHaveText("0.0");
  await expect(page.getByText("Scheduled gym day", { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test("strength: protected routes, missing migration feedback and unavailable workout handling", async ({ page }) => {
  const state = await strengthBackend(page, false);
  await page.goto("/app/strength");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address").fill("strength@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill(crypto.randomUUID());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  state.missingSetup = true;
  await page.goto("/app/strength");
  await expect(page.getByRole("alert")).toContainText("005_strength_tracker.sql");
  state.missingSetup = false;
  await page.getByRole("button", { name: "Retry loading templates", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.goto("/app/workouts/88888888-8888-4888-8888-888888888888/strength");
  await expect(page.getByRole("alert")).toContainText(/not found|unavailable/i);
  expect(state.errors).toEqual([]);
});
