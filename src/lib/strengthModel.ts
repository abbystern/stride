import type { Workout } from "./workoutModel";
export type ExerciseDraft = { name: string; target_sets: string; rep_min: string; rep_max: string; notes: string };
export type TemplateExercise = {
  id: string; exercise_id: string; position: number; target_sets: number; rep_min: number; rep_max: number;
  notes: string | null; exercise: { id: string; name: string };
};
export type StrengthTemplate = { id: string; name: string; workout_type_id: string; template_exercises: TemplateExercise[] };
export type StrengthSet = {
  id: string; workout_id: string; exercise_id: string; set_number: number; exercise_name: string;
  position: number; target_sets: number; rep_min: number; rep_max: number; notes: string | null;
  weight_lbs: number | null; reps: number | null; completed: boolean;
};
export type SetDraft = { id: string; weight_lbs: string; reps: string; completed: boolean };
export type PreviousPerformance = {
  exercise_id: string; workout_id: string; date: string;
  sets: { set_number: number; weight_lbs: number; reps: number }[];
};
export type StrengthSession = { workout: Workout; sets: StrengthSet[]; previous: PreviousPerformance[] };
export const emptyExercise = (): ExerciseDraft => ({ name: "", target_sets: "3", rep_min: "8", rep_max: "10", notes: "" });
export function validateTemplate(name: string, entries: ExerciseDraft[]): string {
  if (!name.trim() || name.trim().length > 120) return "Enter a template name of 1–120 characters.";
  if (!entries.length || entries.length > 30) return "Add between 1 and 30 exercises.";
  const names = new Set<string>();
  for (const [index, item] of entries.entries()) {
    const prefix = `Exercise ${index + 1}: `;
    if (!item.name.trim() || item.name.trim().length > 120) return prefix + "enter a name of 1–120 characters.";
    const key = item.name.trim().toLowerCase();
    if (names.has(key)) return "Use each exercise once per template.";
    names.add(key);
    for (const [label, input, max] of [["sets", item.target_sets, 20], ["minimum reps", item.rep_min, 1000], ["maximum reps", item.rep_max, 1000]] as const) {
      if (!/^\d+$/.test(input) || Number(input) < 1 || Number(input) > max) return prefix + `enter whole-number ${label} from 1 to ${max}.`;
    }
    if (Number(item.rep_max) < Number(item.rep_min)) return prefix + "maximum reps cannot be below minimum reps.";
    if (item.notes.length > 2000) return prefix + "keep notes to 2,000 characters.";
  }
  return "";
}
export function validateSetDrafts(entries: SetDraft[], finish = false): string {
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) return "Duplicate set entries. Reload the workout.";
  for (const [index, entry] of entries.entries()) {
    const weight = entry.weight_lbs.trim() === "" ? null : Number(entry.weight_lbs);
    const reps = entry.reps.trim() === "" ? null : Number(entry.reps);
    if (weight !== null && (!Number.isFinite(weight) || weight < 0)) return `Set ${index + 1}: enter a nonnegative weight in pounds.`;
    if (reps !== null && (!/^\d+$/.test(entry.reps) || reps < 0 || reps > 1000)) return `Set ${index + 1}: enter whole-number reps from 0 to 1000.`;
    if (entry.completed && (weight === null || reps === null || reps <= 0)) return `Set ${index + 1}: completed sets need a weight (zero is allowed) and positive reps.`;
  }
  if (finish && !entries.some((entry) => entry.completed)) return "Complete at least one set before finishing the workout.";
  return "";
}
export function setToDraft(set: StrengthSet): SetDraft {
  return { id: set.id, weight_lbs: set.weight_lbs === null ? "" : String(set.weight_lbs), reps: set.reps === null ? "" : String(set.reps), completed: set.completed };
}
