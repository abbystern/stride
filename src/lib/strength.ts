import { supabase } from "./supabase";
import { getWorkout } from "./workouts";
import { isCalendarDate } from "./calendarModel";
import { validateSetDrafts, validateTemplate, type ExerciseDraft, type SetDraft, type StrengthSet, type StrengthSession, type StrengthTemplate, type PreviousPerformance } from "./strengthModel";

function client() {
  if (!supabase) throw new Error("Connect Supabase before using strength tracking.");
  return supabase;
}
export function strengthError(error: unknown): string {
  const details = error as { code?: string; message?: string };
  if (["PGRST202", "PGRST204", "PGRST205", "42P01", "42883"].includes(details?.code ?? "")) {
    return "Strength tracking isn't set up yet. Run migration 005_strength_tracker.sql in Supabase, then retry.";
  }
  if (details?.code === "42501") return details.message?.includes("Workout is completed")
    ? details.message : "That strength record isn't available to your account. Refresh or sign in again.";
  if (details?.code === "23505") return "Use each exercise once per template, with unique set numbers and exercise positions.";
  if (["23514", "23502", "22P02", "22003"].includes(details?.code ?? "")) return "Check the set counts, rep range, weight, and completed-set values. No changes were saved.";
  if (details?.code === "P0001" || error instanceof Error && !/fetch|network|request/i.test(error.message)) return details.message || "Check your entries and retry.";
  return "We couldn't load or save your strength workout. Check your connection and try again.";
}
export async function listStrengthTemplates(userId: string, signal?: AbortSignal): Promise<StrengthTemplate[]> {
  const rows: StrengthTemplate[] = [];
  while (true) {
    const { data, count, error } = await client().from("workout_templates")
      .select("id,name,workout_type_id,template_exercises(id,exercise_id,position,target_sets,rep_min,rep_max,notes,exercise:exercises(id,name))", { count: "exact" })
      .eq("user_id", userId).order("name").order("id").range(rows.length, rows.length + 499)
      .abortSignal(signal ?? new AbortController().signal).overrideTypes<StrengthTemplate[], { merge: false }>();
    if (error) throw error;
    rows.push(...data);
    if (!data.length || (count !== null ? rows.length >= count : data.length < 500)) break;
  }
  return rows.map((row) => ({ ...row, template_exercises: row.template_exercises.sort((a, b) => a.position - b.position) }));
}
export async function saveStrengthTemplate(id: string | null, name: string, entries: ExerciseDraft[]): Promise<string> {
  const error = validateTemplate(name, entries);
  if (error) throw new Error(error);
  const result = await client().rpc("save_strength_template", {
    p_template_id: id, p_name: name.trim(), p_exercises: entries.map((item) => ({
      name: item.name.trim(), target_sets: Number(item.target_sets), rep_min: Number(item.rep_min), rep_max: Number(item.rep_max), notes: item.notes.trim(),
    })),
  });
  if (result.error) throw result.error;
  if (typeof result.data !== "string") throw new Error("The template wasn't confirmed saved. Reload before retrying.");
  return result.data;
}
export async function startStrengthWorkout(templateId: string, date: string, workoutId: string | null = null): Promise<string> {
  if (!isCalendarDate(date)) throw new Error("Choose a valid workout date.");
  const { data, error } = await client().rpc("start_strength_workout", { p_template_id: templateId, p_date: date, p_workout_id: workoutId });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("The workout wasn't confirmed started. Reload before retrying.");
  return data;
}
export async function getStrengthSession(id: string, userId: string, signal?: AbortSignal): Promise<StrengthSession> {
  const workout = await getWorkout(id, userId, signal);
  if (!workout) throw new Error("Workout not found or unavailable to your account.");
  if (workout.workout_type?.name !== "Strength Training") throw new Error("Set tracking is available for Strength Training workouts only.");
  const sets: StrengthSet[] = [];
  while (true) {
    const { data, count, error } = await client().from("workout_sets").select("*", { count: "exact" })
      .eq("workout_id", id).eq("user_id", userId).order("position").order("set_number").order("id")
      .range(sets.length, sets.length + 499).abortSignal(signal ?? new AbortController().signal)
      .overrideTypes<StrengthSet[], { merge: false }>();
    if (error) throw error;
    sets.push(...data);
    if (!data.length || (count !== null ? sets.length >= count : data.length < 500)) break;
  }
  const { data: previous, error } = await client().rpc("previous_strength_performance", { p_workout_id: id })
    .abortSignal(signal ?? new AbortController().signal);
  if (error) throw error;
  return { workout, sets, previous: previous as PreviousPerformance[] };
}
export async function saveStrengthProgress(workoutId: string, drafts: SetDraft[], finish = false): Promise<void> {
  const validation = validateSetDrafts(drafts, finish);
  if (validation) throw new Error(validation);
  const { error } = await client().rpc("save_strength_progress", {
    p_workout_id: workoutId, p_finish: finish, p_sets: drafts.map((entry) => ({
      id: entry.id, weight_lbs: entry.weight_lbs.trim() === "" ? null : Number(entry.weight_lbs),
      reps: entry.reps.trim() === "" ? null : Number(entry.reps), completed: entry.completed,
    })),
  });
  if (error) throw error;
}
