import assert from "node:assert/strict";
import test from "node:test";
import { calculateCalendarWeek, calendarWeekStart, isCalendarDate, localDateKey, shiftCalendarDate, validateMileageGoal } from "../src/lib/calendarModel.ts";
import type { Workout } from "../src/lib/workoutModel.ts";

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: crypto.randomUUID(), user_id: "test-user", workout_type_id: "running",
    workout_type: { id: "running", name: "Running" }, date: "2026-11-02",
    title: "Easy run", status: "planned", distance_miles: 4, duration_minutes: null,
    run_type: null, target_pace: null, elevation_feet: null, notes: null,
    created_at: "2026-11-01T12:00:00Z", ...overrides,
  };
}

test("calendar weeks are local Monday–Sunday, with previous/next weeks across month and year boundaries", () => {
  assert.equal(calendarWeekStart("2026-11-01"), "2026-10-26");
  assert.equal(calendarWeekStart("2026-11-02"), "2026-11-02");
  assert.equal(calendarWeekStart("2027-01-01"), "2026-12-28");
  assert.equal(shiftCalendarDate("2026-12-28", 7), "2027-01-04");
  assert.equal(shiftCalendarDate("2027-01-04", -7), "2026-12-28");
  assert.equal(localDateKey(new Date(2026, 10, 4, 23, 59)), "2026-11-04");
});

test("calendar dates reject impossible/partial dates and preserve DST and leap-day calendar arithmetic", () => {
  for (const value of ["", "not-a-date", "2026-2-03", "2026-02-30", "2026-13-01", "2026-11-02T00:00Z"]) {
    assert.equal(isCalendarDate(value), false, value);
  }
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(shiftCalendarDate("2026-03-08", 1), "2026-03-09");
  assert.equal(shiftCalendarDate("2026-11-01", 1), "2026-11-02");
  assert.throws(() => calendarWeekStart("2026-02-30"), /valid/);
  assert.throws(() => calculateCalendarWeek([], "2026-11-03"), /Monday/);
});

test("all statuses appear on their exact day; adjacent-week workouts are excluded and input order is unchanged", () => {
  const records = [
    workout({ date: "2026-11-08", status: "completed" }),
    workout({ date: "2026-11-03", status: "in_progress" }),
    workout({ date: "2026-11-01" }), workout({ date: "2026-11-09" }),
    workout({ title: "Zebra" }), workout({ title: "Alpha" }),
  ];
  const original = JSON.stringify(records);
  const summary = calculateCalendarWeek(records, "2026-11-02");
  assert.deepEqual(summary.days.map((day) => day.date), [
    "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
  ]);
  assert.deepEqual(summary.days.map((day) => day.workouts.length), [2, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(summary.days[0].workouts.map((entry) => entry.title), ["Alpha", "Zebra"]);
  assert.equal(JSON.stringify(records), original);
});

test("scheduled mileage is planned plus in-progress Running only; completed mileage stays separate", () => {
  const records = [
    workout({ distance_miles: 4 }), workout({ status: "in_progress", distance_miles: 2 }),
    workout({ status: "completed", distance_miles: 3 }),
    ...["Walking", "Hiking", "Cycling", "Strength Training", "Pilates", "Physical Therapy", "Other"].flatMap((name) =>
      (["planned", "in_progress", "completed"] as const).map((status) =>
        workout({ status, distance_miles: 99, workout_type: { id: name, name } }))),
    workout({ workout_type: null, distance_miles: 999 }),
    workout({ date: "2026-11-09", distance_miles: 100 }),
  ];
  const result = calculateCalendarWeek(records, "2026-11-02");
  assert.equal(result.scheduledMiles, 6);
  assert.equal(result.completedMiles, 3);
  assert.equal(result.days[0].workouts.length, 25);
});

test("missing, zero and invalid distances never produce misleading scheduled or completed totals", () => {
  const records = [null, 0, -1, NaN, Infinity, -Infinity].flatMap((distance_miles) =>
    (["planned", "in_progress", "completed"] as const).map((status) => workout({ distance_miles, status })));
  const result = calculateCalendarWeek(records, "2026-11-02");
  assert.equal(result.scheduledMiles, 0);
  assert.equal(result.completedMiles, 0);
  assert.equal(calculateCalendarWeek([], "2026-11-02").days.every((day) => day.workouts.length === 0), true);
});

test("rescheduling changes day membership and only the affected week's mileage", () => {
  const entry = workout();
  const initial = calculateCalendarWeek([entry], "2026-11-02");
  const sameWeek = calculateCalendarWeek([{ ...entry, date: "2026-11-06" }], "2026-11-02");
  assert.equal(initial.scheduledMiles, sameWeek.scheduledMiles);
  assert.equal(sameWeek.days[0].workouts.length, 0);
  assert.equal(sameWeek.days[4].workouts.length, 1);
  const moved = [{ ...entry, date: "2026-11-09" }];
  assert.equal(calculateCalendarWeek(moved, "2026-11-02").scheduledMiles, 0);
  assert.equal(calculateCalendarWeek(moved, "2026-11-09").scheduledMiles, 4);
});

test("weekly mileage goals allow zero and decimals and reject blank, negative, and nonfinite inputs", () => {
  for (const value of ["", " ", "-1", "abc", "NaN", "Infinity", "-Infinity", "1e999"]) {
    assert.equal(validateMileageGoal(value).value, null, value);
    assert.ok(validateMileageGoal(value).error, value);
  }
  assert.deepEqual(validateMileageGoal("0"), { value: 0, error: "" });
  assert.deepEqual(validateMileageGoal(" 25.5 "), { value: 25.5, error: "" });
});
