// Auth/workout fixtures reuse the calendar harness; no live Supabase writes.
import { expect, type Page } from "@playwright/test";
import { activities, calendarBackend, entry, owner } from "./calendarBackend";
import type { StrengthTemplate, StrengthSet } from "../../../src/lib/strengthModel";

export async function strengthBackend(page: Page, signIn = true) {
  const base = await calendarBackend(page, signIn);
  const state = {
    ...base, templates: [] as StrengthTemplate[], sets: [] as StrengthSet[],
    failWrite: false, missingSetup: false, writes: 0,
    names: new Map<string, { id: string; name: string }>(),
  };
  const activity = activities.find((item) => item.name === "Strength Training")!;
  await page.route(/\/rest\/v1\/(workout_templates|workout_sets)(\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
    if (state.missingSetup) return route.fulfill({ status: 404, json: { code: "PGRST205", message: "Fixture: missing table" } });
    const rows = url.pathname.endsWith("workout_templates") ? state.templates :
      state.sets.filter((set) => set.workout_id === url.searchParams.get("workout_id")!.replace(/^eq\./, ""));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const slice = rows.slice(offset, offset + Number(url.searchParams.get("limit") ?? 500));
    return route.fulfill({ headers: { "content-range": slice.length ? `${offset}-${offset + slice.length - 1}/${rows.length}` : `*/${rows.length}` }, json: slice });
  });
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = new URL(route.request().url()).pathname.split("/").pop();
    const body = route.request().postDataJSON();
    if (state.missingSetup) return route.fulfill({ status: 404, json: { code: "PGRST202", message: "Fixture: missing RPC" } });
    if (rpc === "previous_strength_performance") {
      const active = base.rows.find((row) => row.id === body.p_workout_id && row.user_id === owner)!;
      const groups = [...new Set(state.sets.filter((set) => set.workout_id === active.id).map((set) => set.exercise_id))];
      const previous = groups.flatMap((exercise_id) => {
        const candidates = base.rows.filter((row) => row.user_id === owner && row.id !== active.id && row.status === "completed" &&
          row.date <= active.date && state.sets.some((set) => set.workout_id === row.id && set.exercise_id === exercise_id && set.completed))
          .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
        const row = candidates[0];
        return row ? [{ exercise_id, workout_id: row.id, date: row.date,
          sets: state.sets.filter((set) => set.workout_id === row.id && set.exercise_id === exercise_id && set.completed)
            .map(({ set_number, weight_lbs, reps }) => ({ set_number, weight_lbs, reps })) }] : [];
      });
      return route.fulfill({ json: previous });
    }
    state.writes++;
    if (state.failWrite) { state.failWrite = false; return route.fulfill({ status: 503, json: { code: "PGRST000", message: "Fixture outage" } }); }
    if (rpc === "save_strength_template") {
      const id = body.p_template_id ?? crypto.randomUUID();
      const children = body.p_exercises.map((item: { name: string; target_sets: number; rep_min: number; rep_max: number; notes: string }, index: number) => {
        const key = item.name.trim().toLowerCase();
        let exercise = state.names.get(key);
        if (!exercise) { exercise = { id: crypto.randomUUID(), name: item.name.trim() }; state.names.set(key, exercise); }
        return { id: crypto.randomUUID(), exercise_id: exercise.id, exercise, position: index + 1,
          target_sets: item.target_sets, rep_min: item.rep_min, rep_max: item.rep_max, notes: item.notes || null };
      });
      const template = { id, name: body.p_name, workout_type_id: activity.id, template_exercises: children };
      const index = state.templates.findIndex((item) => item.id === id);
      if (index < 0) state.templates.push(template); else state.templates[index] = template;
      return route.fulfill({ json: id });
    }
    if (rpc === "start_strength_workout") {
      const template = state.templates.find((item) => item.id === body.p_template_id)!;
      let row = body.p_workout_id ? base.rows.find((item) => item.id === body.p_workout_id && item.user_id === owner)! : null;
      if (!row) { row = entry({ workout_type_id: activity.id, title: template.name, date: body.p_date, status: "in_progress" }); base.rows.push(row); }
      row.status = "in_progress";
      for (const item of template.template_exercises) for (let n = 1; n <= item.target_sets; n++) state.sets.push({
        id: crypto.randomUUID(), workout_id: row.id, exercise_id: item.exercise_id, exercise_name: item.exercise.name,
        position: item.position, target_sets: item.target_sets, rep_min: item.rep_min, rep_max: item.rep_max, notes: item.notes,
        set_number: n, reps: null, weight_lbs: null, completed: false,
      });
      return route.fulfill({ json: row.id });
    }
    expect(rpc).toBe("save_strength_progress");
    const workout = base.rows.find((row) => row.id === body.p_workout_id && row.user_id === owner)!;
    for (const changes of body.p_sets) {
      const row = state.sets.find((set) => set.id === changes.id && set.workout_id === workout.id)!;
      Object.assign(row, changes);
    }
    workout.status = body.p_finish ? "completed" : "in_progress";
    return route.fulfill({ json: workout.id });
  });
  return state;
}
