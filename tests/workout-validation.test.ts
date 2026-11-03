import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyWorkoutValues,
  localDateString,
  RUN_TYPES,
  validateWorkout,
  WORKOUT_STATUSES,
  workoutToFormValues,
  type Workout,
} from "../src/lib/workoutModel.ts";

const types = [{ id: "running", name: "Running" }, { id: "walking", name: "Walking" }];
const valid = () => ({
  ...emptyWorkoutValues(),
  title: "  Morning run  ",
  date: "2026-11-03",
  workout_type_id: "running",
});

test("required fields and unknown selections are rejected", () => {
  const { errors, payload } = validateWorkout({
    ...valid(), title: " \t\n", date: "", workout_type_id: "missing", status: "",
  }, types);
  assert.equal(payload, null);
  assert.deepEqual(Object.keys(errors).sort(), ["date", "status", "title", "workout_type_id"]);
});

test("impossible calendar dates are rejected", () => {
  for (const date of ["2026-02-30", "2026-13-01", "0000-01-01", "not-a-date"]) {
    assert.ok(validateWorkout({ ...valid(), date }, types).errors.date);
  }
  assert.ok(validateWorkout({ ...valid(), date: "2028-02-29" }, types).payload);
});

test("blank optional measurements are null; titles are trimmed", () => {
  const { payload } = validateWorkout(valid(), types);
  assert.equal(payload?.title, "Morning run");
  assert.equal(payload?.distance_miles, null);
  assert.equal(payload?.duration_minutes, null);
  assert.equal(payload?.elevation_feet, null);
  assert.equal(payload?.notes, null);
});

test("negative, nonnumeric, and nonfinite optional numbers cannot be saved", () => {
  for (const field of ["distance_miles", "duration_minutes", "elevation_feet"] as const) {
    for (const value of ["-1", "NaN", "Infinity", "-Infinity", "oops", "1e999"]) {
      const result = validateWorkout({ ...valid(), [field]: value }, types);
      assert.equal(result.payload, null);
      assert.ok(result.errors[field]);
    }
  }
});

test("zero and decimal measurements are retained", () => {
  const { payload } = validateWorkout({
    ...valid(), distance_miles: "0", duration_minutes: "35.5", elevation_feet: "0",
  }, types);
  assert.equal(payload?.distance_miles, 0);
  assert.equal(payload?.duration_minutes, 35.5);
  assert.equal(payload?.elevation_feet, 0);
});

test("all specified statuses and six run types are available", () => {
  assert.equal(RUN_TYPES.length, 6);
  for (const { value } of WORKOUT_STATUSES) {
    assert.equal(validateWorkout({ ...valid(), status: value }, types).payload?.status, value);
  }
});

test("running-specific values persist for runs and clear for another activity", () => {
  const fields = { ...valid(), run_type: "Long Run", target_pace: " 9:00 / mile ", notes: " Easy effort " };
  assert.equal(validateWorkout(fields, types).payload?.target_pace, "9:00 / mile");
  const { payload } = validateWorkout({ ...fields, workout_type_id: "walking" }, types);
  assert.equal(payload?.run_type, null);
  assert.equal(payload?.target_pace, null);
  assert.equal(payload?.notes, "Easy effort");
  assert.ok(!("user_id" in (payload ?? {})));
});

test("edit initialization retains zero rather than treating it as missing", () => {
  const record = {
    ...validateWorkout(valid(), types).payload,
    distance_miles: 0, duration_minutes: null, elevation_feet: 0,
  } as Workout;
  const form = workoutToFormValues(record);
  assert.equal(form.distance_miles, "0");
  assert.equal(form.duration_minutes, "");
  assert.equal(form.elevation_feet, "0");
});

test("new workout date uses the local calendar date", () => {
  assert.equal(localDateString(new Date(2026, 0, 2, 23, 55)), "2026-01-02");
});
