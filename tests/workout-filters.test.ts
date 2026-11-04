import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WORKOUT_FILTERS,
  filterAndSortWorkouts,
  hasWorkoutFilters,
  WORKOUT_SORT_OPTIONS,
  type WorkoutFilters,
} from "../src/lib/workoutFilters.ts";
import type { Workout } from "../src/lib/workoutModel.ts";

function workout(id: string, overrides: Partial<Workout> = {}): Workout {
  return {
    id, user_id: "owner", title: "Workout", workout_type_id: "running",
    workout_type: null, date: "2026-11-01", status: "completed",
    distance_miles: null, duration_minutes: null, elevation_feet: null,
    run_type: null, target_pace: null, notes: null,
    created_at: "2026-11-01T12:00:00Z", ...overrides,
  };
}
const rows = [
  workout("1", { date: "2026-11-08", title: "Easy Run", status: "planned", distance_miles: 3 }),
  workout("2", { title: "Morning TEMPO", distance_miles: 6 }),
  workout("3", { date: "2026-11-05", title: "Tempo ride", workout_type_id: "cycling", distance_miles: 12 }),
  workout("4", { date: "2026-10-31", title: "Recovery", status: "in_progress" }),
  workout("5", { date: "2026-11-06", title: "Walk", workout_type_id: "walking", distance_miles: 0 }),
  workout("6", { date: "2026-11-09", title: "Other workout", workout_type_id: "other", status: "planned" }),
];
const filter = (changes: Partial<WorkoutFilters> = {}) =>
  filterAndSortWorkouts(rows, { ...DEFAULT_WORKOUT_FILTERS, ...changes }).map((row) => row.id);

test("default newest-first and oldest-first use workout dates", () => {
  assert.deepEqual(filter(), ["6", "1", "5", "3", "2", "4"]);
  assert.deepEqual(filter({ sort: "oldest" }), ["4", "2", "3", "5", "1", "6"]);
});

test("distance is descending and missing distances follow zero", () => {
  assert.deepEqual(filter({ sort: "distance" }), ["3", "2", "1", "5", "6", "4"]);
});

test("title search ignores case and surrounding whitespace", () => {
  assert.deepEqual(filter({ search: "  tEmPo  " }), ["3", "2"]);
  assert.deepEqual(filter({ search: "  " }), filter());
});

test("search, activity, status, and ordering combine", () => {
  assert.deepEqual(filter({ search: "tempo", activityId: "running", status: "completed", sort: "oldest" }), ["2"]);
  assert.deepEqual(filter({ activityId: "running", status: "planned" }), ["1"]);
  assert.deepEqual(filter({ activityId: "running", status: "in_progress" }), ["4"]);
  assert.deepEqual(filter({ status: "completed", sort: "distance" }), ["3", "2", "5"]);
});

test("unmatched filters return an empty array", () => {
  assert.deepEqual(filter({ search: "missing title" }), []);
  assert.deepEqual(filter({ activityId: "missing-activity" }), []);
  assert.deepEqual(filter({ search: "tempo", status: "planned" }), []);
});

test("search is literal, not a wildcard or regular expression, and excludes notes", () => {
  const special = workout("special", { title: "100% _TEMPO* \\ trail", notes: "not searchable" });
  for (const search of ["%", "_", "*", "\\", "100% _tempo*"]) {
    assert.equal(filterAndSortWorkouts([special], { ...DEFAULT_WORKOUT_FILTERS, search }).length, 1);
  }
  assert.equal(filterAndSortWorkouts([special], { ...DEFAULT_WORKOUT_FILTERS, search: "not searchable" }).length, 0);
});

test("sorting does not mutate the shared workout array", () => {
  const original = rows.map((row) => ({ ...row }));
  filter({ sort: "oldest" });
  filter({ sort: "distance" });
  assert.deepEqual(rows, original);
});

test("equal dates and distances have deterministic creation-time and ID ordering", () => {
  const tied = [
    workout("b", { created_at: "2026-11-01T10:00:00Z", distance_miles: 2 }),
    workout("a", { created_at: "2026-11-01T11:00:00Z", distance_miles: 2 }),
    workout("c", { created_at: "2026-11-01T11:00:00Z", distance_miles: 2 }),
  ];
  assert.deepEqual(filterAndSortWorkouts(tied, DEFAULT_WORKOUT_FILTERS).map((row) => row.id), ["a", "c", "b"]);
  assert.deepEqual(filterAndSortWorkouts(tied, { ...DEFAULT_WORKOUT_FILTERS, sort: "oldest" }).map((row) => row.id), ["b", "a", "c"]);
});

test("all activity IDs are supported without hardcoded type names", () => {
  const all = ["running", "strength", "cycling", "pilates", "pt", "walking", "hiking", "other"];
  const workouts = all.map((id) => workout(id, { workout_type_id: id }));
  for (const activityId of all) {
    assert.deepEqual(filterAndSortWorkouts(workouts, { ...DEFAULT_WORKOUT_FILTERS, activityId }).map((row) => row.id), [activityId]);
  }
});

test("active-filter detection excludes sorting and default controls include all requested orders", () => {
  assert.equal(hasWorkoutFilters(DEFAULT_WORKOUT_FILTERS), false);
  assert.equal(hasWorkoutFilters({ ...DEFAULT_WORKOUT_FILTERS, sort: "distance" }), false);
  assert.equal(hasWorkoutFilters({ ...DEFAULT_WORKOUT_FILTERS, search: "tempo" }), true);
  assert.equal(hasWorkoutFilters({ ...DEFAULT_WORKOUT_FILTERS, activityId: "running" }), true);
  assert.equal(hasWorkoutFilters({ ...DEFAULT_WORKOUT_FILTERS, status: "planned" }), true);
  assert.deepEqual(WORKOUT_SORT_OPTIONS.map((option) => option.label), ["Newest first", "Oldest first", "Longest distance first"]);
});
