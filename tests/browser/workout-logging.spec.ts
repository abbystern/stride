// UI/API-contract tests: all Auth and PostgREST requests are intercepted.
// No real Supabase account is created and no remote training records are touched.
import { expect, test, type Page } from "@playwright/test";

const owner = "11111111-1111-4111-8111-111111111111";
const otherOwner = "22222222-2222-4222-8222-222222222222";
const names = ["Running", "Strength Training", "Cycling", "Pilates", "Physical Therapy", "Walking", "Hiking", "Other"];
const activities = names.map((name, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, name,
}));
type RecordData = Record<string, unknown>;

function record(overrides: RecordData = {}): RecordData {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: owner, workout_type_id: activities[0].id,
    date: "2026-11-03", title: "Saved easy run", status: "planned",
    distance_miles: 4, duration_minutes: 40, elevation_feet: 0,
    run_type: "Easy/Base", target_pace: "10:00 / mile", notes: "Original notes",
    created_at: new Date().toISOString(), ...overrides,
  };
}

async function backend(page: Page, signIn = true) {
  const state = {
    rows: [] as RecordData[],
    createCalls: 0, deleteCalls: 0, failWrite: false, failDelete: false,
    failRead: false,
    stars: new Set<string>(),
    starWriteCalls: 0,
    failStarWrite: false,
    failStarLoad: false,
    delayStarWrite: false,
    pageErrors: [] as string[],
  };
  page.on("pageerror", (error) => state.pageErrors.push(error.message));
  const now = Math.floor(Date.now() / 1000);
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: owner, exp: now + 3600, iat: now, role: "authenticated" })).toString("base64url"),
    "test-signature-not-valid-for-any-real-server",
  ].join(".");
  const user = {
    id: owner, aud: "authenticated", role: "authenticated",
    email: "stride-test@example.invalid", email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email" }, user_metadata: {},
    created_at: new Date().toISOString(), identities: [],
  };
  await page.route("**/auth/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/logout")) {
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({ json: path.endsWith("/user") ? user : {
        access_token: jwt, token_type: "bearer", expires_in: 3600,
        expires_at: now + 3600, refresh_token: "local-test-refresh-token", user,
      } });
    }
  });
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.pathname.endsWith("/stars")) {
      if (method === "GET") {
        expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
        if (state.failStarLoad) return route.fulfill({
          status: 404, json: { code: "PGRST205", message: "Fixture: missing stars table" },
        });
        return route.fulfill({ json: [...state.stars].map((workout_id) => ({
          id: crypto.randomUUID(), workout_id,
        })) });
      }
      state.starWriteCalls++;
      if (state.delayStarWrite) await new Promise((resolve) => setTimeout(resolve, 500));
      if (state.failStarWrite) {
        state.failStarWrite = false;
        return route.fulfill({ status: 503, json: { code: "PGRST000", message: "Fixture: outage" } });
      }
      if (method === "POST") {
        const body = request.postDataJSON();
        expect(body.user_id).toBe(owner);
        expect(url.searchParams.get("on_conflict")).toBe("user_id,workout_id");
        expect(request.headers().prefer).toContain("resolution=ignore-duplicates");
        if (!state.rows.some((row) => row.id === body.workout_id && row.user_id === owner)) {
          return route.fulfill({ status: 403, json: { code: "42501", message: "Fixture: ownership rejected" } });
        }
        state.stars.add(body.workout_id);
        return route.fulfill({ status: 201, body: "" });
      }
      expect(method).toBe("DELETE");
      expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
      state.stars.delete(url.searchParams.get("workout_id")!.replace(/^eq\./, ""));
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.endsWith("/workout_types")) {
      return route.fulfill({ json: activities });
    }
    expect(url.pathname.endsWith("/workouts")).toBe(true);
    const joined = (row: RecordData) => ({
      ...row, workout_type: activities.find((item) => item.id === row.workout_type_id),
    });
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    if (method !== "POST") {
      expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
    }
    if (method === "GET") {
      if (state.failRead) return route.fulfill({
        status: 404, json: { code: "PGRST205", message: "Fixture: missing table" },
      });
      return route.fulfill({
        json: state.rows.filter((row) => row.user_id === owner && (!id || row.id === id)).map(joined),
      });
    }
    if (method === "POST") {
      state.createCalls++;
      const body = request.postDataJSON();
      expect(body.user_id).toBe(owner);
      if (state.failWrite) {
        state.failWrite = false;
        return route.fulfill({ status: 503, json: { code: "PGRST000", message: "Fixture: outage" } });
      }
      const row = record({ ...body, id: crypto.randomUUID() });
      state.rows.push(row);
      return route.fulfill({ status: 201, json: joined(row) });
    }
    const index = state.rows.findIndex((row) => row.id === id && row.user_id === owner);
    if (method === "PATCH") {
      const body = request.postDataJSON();
      expect(body).not.toHaveProperty("user_id");
      if (index < 0) return route.fulfill({ json: [] });
      state.rows[index] = { ...state.rows[index], ...body };
      return route.fulfill({ json: [joined(state.rows[index])] });
    }
    if (method === "DELETE") {
      state.deleteCalls++;
      if (state.failDelete) {
        state.failDelete = false;
        return route.fulfill({ status: 503, json: { code: "PGRST000", message: "Fixture: outage" } });
      }
      if (index < 0) return route.fulfill({ json: [] });
      const [deleted] = state.rows.splice(index, 1);
      state.stars.delete(String(deleted.id));
      return route.fulfill({ json: [{ id: deleted.id }] });
    }
    return route.fulfill({ status: 400, json: { message: "Unexpected test request" } });
  });
  if (signIn) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill("test-only-input-not-a-real-account");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
  }
  return state;
}

async function fillBasics(page: Page, title: string, activity = activities[0].id) {
  await page.getByLabel("Workout title").fill(title);
  await page.getByLabel(/^Date/).fill("2026-11-03");
  await page.getByLabel(/^Activity/).selectOption(activity);
}

test("create, read after refresh, edit, cancel delete, retry failed delete, and delete", async ({ page }) => {
  const state = await backend(page);
  await page.getByRole("link", { name: "Workout history", exact: true }).click();
  await expect(page.getByText("Your journal starts here")).toBeVisible();
  await page.getByRole("link", { name: "Log your first workout" }).click();
  await fillBasics(page, "Morning trail run");
  await expect(page.getByLabel(/^Activity/).locator("option")).toHaveCount(9);
  await page.getByLabel(/^Status/).selectOption("completed");
  await page.getByLabel("Run type", { exact: true }).selectOption("Long Run");
  await page.getByLabel("Target pace").fill("9:00 / mile");
  await page.getByLabel("Distance (miles)").fill("0");
  await page.getByLabel("Duration (minutes)").fill("30.5");
  await page.getByLabel("Elevation gain (feet)").fill("0");
  await page.getByLabel("Notes").fill("Comfortable effort");
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByRole("heading", { name: "Morning trail run" })).toBeVisible();
  expect(state.rows).toHaveLength(1);
  await page.reload();
  await expect(page.getByText("Comfortable effort")).toBeVisible();
  await expect(page.getByText("0 miles", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit workout" }).click();
  await expect(page.getByLabel("Workout title")).toHaveValue("Morning trail run");
  await page.getByLabel("Workout title").fill("Updated trail run");
  await page.getByLabel(/^Status/).selectOption("in_progress");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Updated trail run" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("In Progress", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delete this workout?" })).toBeVisible();
  expect(state.deleteCalls).toBe(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(state.rows).toHaveLength(1);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  state.failDelete = true;
  await page.getByRole("button", { name: "Delete workout", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(state.rows).toHaveLength(1);
  await page.getByRole("button", { name: "Delete workout", exact: true }).click();
  await expect(page.getByText("Your journal starts here")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Your journal starts here")).toBeVisible();
  expect(state.rows).toHaveLength(0);
  expect(state.pageErrors).toEqual([]);
});

test("required fields and negative measurements block writes with field errors", async ({ page }) => {
  const state = await backend(page);
  await page.goto("/app/workouts/new");
  await page.getByLabel(/^Date/).fill("");
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByText("Give your workout a title.")).toBeVisible();
  await expect(page.getByText("Choose a valid workout date.")).toBeVisible();
  await expect(page.getByText("Choose an activity type.")).toBeVisible();
  await fillBasics(page, "Valid title");
  for (const label of ["Distance (miles)", "Duration (minutes)", "Elevation gain (feet)"]) {
    await page.getByLabel(label).fill("-1");
  }
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(3);
  expect(state.createCalls).toBe(0);
  await expect(page.getByLabel("Distance (miles)")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(state.pageErrors).toEqual([]);
});

test("all eight activities can be saved; running fields are conditional", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await backend(page);
  for (const activity of activities) {
    await page.goto("/app/workouts/new");
    await fillBasics(page, `Test ${activity.name}`, activity.id);
    await expect(page.getByLabel("Run type", { exact: true })).toHaveCount(activity.name === "Running" ? 1 : 0);
    await page.getByRole("button", { name: "Save workout" }).click();
    await expect(page.getByRole("heading", { name: `Test ${activity.name}`, exact: true })).toBeVisible();
  }
  expect(state.rows).toHaveLength(8);
  expect(state.rows.every((row) => row.duration_minutes === null && row.distance_miles === null)).toBe(true);
  await page.goto("/app/workouts");
  await expect(page.getByRole("link", { name: /^Open Test / })).toHaveCount(8);
  expect(state.pageErrors).toEqual([]);
});

test("editing activity clears hidden running-only fields and preserves zero values", async ({ page }) => {
  const state = await backend(page);
  const row = record();
  state.rows.push(row);
  await page.goto(`/app/workouts/${row.id}/edit`);
  await expect(page.getByLabel("Elevation gain (feet)")).toHaveValue("0");
  await page.getByLabel(/^Activity/).selectOption(activities[5].id);
  await expect(page.getByLabel("Run type", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Saved easy run" })).toBeVisible();
  expect(state.rows[0].run_type).toBeNull();
  expect(state.rows[0].target_pace).toBeNull();
  expect(state.rows[0].elevation_feet).toBe(0);
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.getByText("Walking", { exact: true })).toBeVisible();
  await expect(page.getByText("4 mi", { exact: true })).toBeVisible();
  expect(state.pageErrors).toEqual([]);
});

test("database errors retain input and offer retry, without fake success", async ({ page }) => {
  const state = await backend(page);
  await page.goto("/app/workouts/new");
  await fillBasics(page, "Keep my entered title");
  state.failWrite = true;
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Workout title")).toHaveValue("Keep my entered title");
  expect(state.rows).toHaveLength(0);
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByRole("heading", { name: "Keep my entered title" })).toBeVisible();
  expect(state.rows).toHaveLength(1);
  state.failRead = true;
  await page.goto("/app/workouts");
  await expect(page.getByRole("alert")).toContainText("002_workout_database.sql");
  state.failRead = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("link", { name: /^Open Keep my entered title/ })).toBeVisible();
  expect(state.pageErrors).toEqual([]);
});

test("unavailable and other-user workout IDs show no private details or controls", async ({ page }) => {
  const state = await backend(page);
  const privateRow = record({ user_id: otherOwner, title: "Another user's private session" });
  state.rows.push(privateRow);
  for (const suffix of ["", "/edit"]) {
    await page.goto(`/app/workouts/${privateRow.id}${suffix}`);
    await expect(page.getByRole("heading", { name: "Workout not found" })).toBeVisible();
    await expect(page.getByText(String(privateRow.title))).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  }
  expect(state.pageErrors).toEqual([]);
});

test("all workout routes redirect signed-out visitors without bypassing auth", async ({ page }) => {
  await backend(page, false);
  for (const path of ["/app/workouts", "/app/stars", "/app/workouts/new", "/app/workouts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/edit"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  }
});

test("stars: card, detail and favorites share saved state across refreshes", async ({ page }) => {
  const state = await backend(page);
  state.rows.push(record(), record({
    id: "abababab-abab-4bab-8bab-abababababab", title: "Evening walk",
  }));
  await page.goto("/app/workouts");
  const star = page.getByRole("button", { name: "Star Saved easy run", exact: true });
  await expect(star).toHaveAttribute("aria-pressed", "false");
  await star.click();
  await expect(page.getByRole("button", { name: "Unstar Saved easy run" })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/app\/workouts$/);
  expect(state.stars.size).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Unstar Saved easy run" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: /^Open Saved easy run,/ }).click();
  await expect(page.getByRole("button", { name: "Unstar Saved easy run" })).toBeVisible();
  await page.getByRole("button", { name: "Unstar Saved easy run" }).click();
  await expect(page.getByRole("button", { name: "Star Saved easy run", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Star Saved easy run", exact: true }).click();
  await page.goto("/app");
  await page.getByRole("link", { name: "Starred workouts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Starred Workouts", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Open Saved easy run,/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Open Evening walk,/ })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("starred-workouts.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: /^Open Saved easy run,/ }).click();
  await expect(page.getByRole("heading", { name: "Saved easy run", exact: true })).toBeVisible();
  await page.goto("/app/stars");
  await page.getByRole("button", { name: "Unstar Saved easy run" }).click();
  await expect(page.locator(".starred-empty")).toBeVisible();
  await page.reload();
  await expect(page.locator(".starred-empty")).toBeVisible();
  expect(state.stars.size).toBe(0);
  expect(state.pageErrors).toEqual([]);
});

test("stars: failed changes retain the saved state and repeated clicks send one write", async ({ page }) => {
  const state = await backend(page);
  state.rows.push(record());
  await page.goto("/app/workouts");
  state.failStarWrite = true;
  await page.getByRole("button", { name: "Star Saved easy run", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Check your connection");
  await expect(page.getByRole("button", { name: "Star Saved easy run", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(state.stars.size).toBe(0);
  state.delayStarWrite = true;
  const writesBefore = state.starWriteCalls;
  await page.getByRole("button", { name: "Star Saved easy run", exact: true }).evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByRole("button", { name: "Star Saved easy run", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Unstar Saved easy run" })).toBeEnabled();
  expect(state.starWriteCalls - writesBefore).toBe(1);
  state.failStarWrite = true;
  await page.getByRole("button", { name: "Unstar Saved easy run" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unstar Saved easy run" })).toHaveAttribute("aria-pressed", "true");
  expect(state.stars.size).toBe(1);
  expect(state.pageErrors).toEqual([]);
});

test("stars: missing migration has a useful error, blocks toggles, and can retry", async ({ page }) => {
  const state = await backend(page);
  state.rows.push(record());
  state.failStarLoad = true;
  await page.goto("/app/workouts");
  await expect(page.getByRole("alert")).toContainText("003_stars.sql");
  await expect(page.getByRole("button", { name: "Star Saved easy run", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: /^Open Saved easy run,/ })).toBeVisible();
  await page.goto("/app/stars");
  await expect(page.getByRole("alert")).toContainText("003_stars.sql");
  await expect(page.locator(".starred-empty")).toHaveCount(0);
  state.failStarLoad = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".starred-empty")).toBeVisible();
  expect(state.pageErrors).toEqual([]);
});

test("stars: workout deletion clears favorites and private workout IDs stay hidden", async ({ page }) => {
  const state = await backend(page);
  const privateId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  state.rows.push(record(), record({ id: privateId, user_id: otherOwner, title: "Private other workout" }));
  state.stars.add("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  // A corrupt fixture ID must not bypass the separately owner-filtered workouts.
  state.stars.add(privateId);
  await page.goto("/app/stars");
  await expect(page.getByRole("link", { name: /^Open Saved easy run,/ })).toBeVisible();
  await expect(page.getByText("Private other workout", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: /^Open Saved easy run,/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete workout", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/workouts$/);
  await page.goto("/app/stars");
  await expect(page.locator(".starred-empty")).toBeVisible();
  await page.reload();
  await expect(page.locator(".starred-empty")).toBeVisible();
  expect(state.pageErrors).toEqual([]);
});
