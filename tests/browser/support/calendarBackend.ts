// Synthetic Auth/PostgREST fixtures. No remote credentials or records are used.
import { expect, type Page } from "@playwright/test";
import type { Workout } from "../../../src/lib/workoutModel";
import type { WeeklyGoal } from "../../../src/lib/weeklyGoals";

export const owner = "11111111-1111-4111-8111-111111111111";
export const otherOwner = "22222222-2222-4222-8222-222222222222";
export const activities = ["Running", "Walking", "Hiking", "Cycling", "Strength Training", "Pilates", "Physical Therapy", "Other", "Rest Day"]
  .map((name, index) => ({ name, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` }));

export function entry(overrides: Partial<Workout> = {}): Workout {
  return {
    id: crypto.randomUUID(), user_id: owner, workout_type_id: activities[0].id,
    date: "2026-11-02", scheduled_start_time: null, title: "Monday easy run", status: "planned",
    distance_miles: 4, duration_minutes: 40, run_type: "Easy/Base",
    target_pace: null, elevation_feet: 0, notes: "Preserve these notes",
    created_at: "2026-11-01T12:00:00Z", workout_type: activities[0], ...overrides,
  };
}

export async function calendarBackend(page: Page, signIn = true) {
  const state = {
    rows: [] as Workout[], goals: [] as WeeklyGoal[], errors: [] as string[],
    failMove: false, failGoalSave: false, missingGoals: false, failRead: false, missingTimes: false, missingRest: false,
    patchCalls: 0, goalWriteCalls: 0, workoutReadCalls: 0,
    lastPatch: null as Record<string, unknown> | null,
  };
  page.on("pageerror", (error) => state.errors.push(error.message));
  const now = Math.floor(Date.now() / 1000);
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: owner, exp: now + 3600, iat: now, role: "authenticated" })).toString("base64url"),
    "fixture-not-a-valid-server-signature",
  ].join(".");
  const user = { id: owner, aud: "authenticated", role: "authenticated", email: "calendar@example.invalid",
    email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email" }, user_metadata: {},
    created_at: new Date().toISOString(), identities: [] };
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: route.request().url().endsWith("/user") ? user : {
    access_token: jwt, refresh_token: "invalid-fixture-refresh-value", token_type: "bearer",
    expires_in: 3600, expires_at: now + 3600, user,
  } }));
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    const method = request.method();
    const failure = () => route.fulfill({ status: 503, json: { code: "PGRST000", message: "Fixture outage" } });
    if (table === "stars") return route.fulfill({ json: [] });
    if (table === "workout_types") return route.fulfill({ json: state.missingRest ? activities.filter((type) => type.name !== "Rest Day") : activities });
    if (table === "weekly_goals") {
      if (state.missingGoals) return route.fulfill({ status: 404, json: { code: "PGRST205", message: "Fixture: missing table" } });
      if (method === "GET") {
        expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
        const week = url.searchParams.get("week_start")!.replace(/^eq\./, "");
        return route.fulfill({ json: state.goals.filter((goal) => goal.user_id === owner && goal.week_start === week) });
      }
      expect(method).toBe("POST");
      expect(url.searchParams.get("on_conflict")).toBe("user_id,week_start");
      expect(request.headers().prefer).toContain("resolution=merge-duplicates");
      const body = request.postDataJSON();
      expect(body.user_id).toBe(owner);
      state.goalWriteCalls++;
      if (state.failGoalSave) { state.failGoalSave = false; return failure(); }
      const index = state.goals.findIndex((goal) => goal.user_id === owner && goal.week_start === body.week_start);
      const goal = { id: index < 0 ? crypto.randomUUID() : state.goals[index].id, ...body } as WeeklyGoal;
      if (index < 0) state.goals.push(goal); else state.goals[index] = goal;
      return route.fulfill({ status: 201, json: goal });
    }
    expect(table).toBe("workouts");
    const joined = (row: Workout) => ({ ...row, workout_type: activities.find((activity) => activity.id === row.workout_type_id) ?? null });
    if (method === "POST") {
      const body = request.postDataJSON();
      expect(body.user_id).toBe(owner);
      if (state.missingTimes && "scheduled_start_time" in body) return route.fulfill({ status: 400, json: { code: "PGRST204", message: "Could not find scheduled_start_time" } });
      const row = entry(body);
      state.rows.push(row);
      return route.fulfill({ status: 201, json: joined(row) });
    }
    expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    if (method === "GET") {
      state.workoutReadCalls++;
      if (state.failRead) return failure();
      const rows = state.rows.filter((row) => row.user_id === owner && (!id || row.id === id));
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 500);
      const slice = rows.slice(offset, offset + limit);
      return route.fulfill({ headers: { "content-range": slice.length ? `${offset}-${offset + slice.length - 1}/${rows.length}` : `*/${rows.length}` }, json: slice.map((row) => {
        const result = joined(row);
        if (state.missingTimes) delete result.scheduled_start_time;
        return result;
      }) });
    }
    if (method === "DELETE") {
      const index = state.rows.findIndex((item) => item.id === id && item.user_id === owner);
      const deleted = index < 0 ? [] : state.rows.splice(index, 1).map((row) => ({ id: row.id }));
      return route.fulfill({ json: deleted });
    }
    expect(method).toBe("PATCH");
    state.patchCalls++;
    state.lastPatch = request.postDataJSON();
    expect(state.lastPatch).not.toHaveProperty("user_id");
    expect(Object.keys(state.lastPatch!).every((key) => ["date", "scheduled_start_time", "title", "workout_type_id", "status", "run_type", "distance_miles", "duration_minutes", "target_pace", "elevation_feet", "notes"].includes(key))).toBe(true);
    if (state.missingTimes && "scheduled_start_time" in state.lastPatch!) return route.fulfill({ status: 400, json: { code: "PGRST204", message: "Could not find scheduled_start_time" } });
    if (state.failMove) { state.failMove = false; return failure(); }
    const row = state.rows.find((item) => item.id === id && item.user_id === owner);
    if (!row) return route.fulfill({ json: [] });
    Object.assign(row, state.lastPatch);
    return route.fulfill({ json: [joined(row)] });
  });
  if (signIn) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(crypto.randomUUID());
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
  }
  return state;
}
