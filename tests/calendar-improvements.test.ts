import assert from "node:assert/strict";
import test from "node:test";
import { calculateCalendarMonth, calculateCalendarWeek, calendarMonthStart, shiftCalendarMonth } from "../src/lib/calendarModel.ts";
import { calculateDashboard } from "../src/lib/dashboard.ts";
import { emptyWorkoutValues, formatWorkoutTime, isWorkoutTime, validateWorkout, workoutToFormValues, type Workout } from "../src/lib/workoutModel.ts";

const types = [{ id: "run", name: "Running" }, { id: "rest", name: "Rest Day" }, { id: "strength", name: "Strength Training" }];
const entry = (changes: Partial<Workout> = {}): Workout => ({
  id: "1", user_id: "owner", workout_type_id: "run", date: "2026-11-04", title: "Morning run",
  status: "completed", run_type: null, distance_miles: 5, duration_minutes: 50,
  target_pace: null, elevation_feet: null, notes: null, created_at: "2026-11-04T12:00:00Z",
  workout_type: types[0], ...changes,
});
test("times accept HH:MM, preserve local clock values and format noon/midnight", () => {
  for (const value of ["00:00", "06:30", "12:00", "23:59"]) assert.equal(isWorkoutTime(value), true);
  for (const value of ["24:00", "7:00", "12:60", "06:30:01", "2026-11-04T06:30Z", ""]) assert.equal(isWorkoutTime(value), false);
  assert.equal(formatWorkoutTime("00:00:00"), "12:00 AM");
  assert.equal(formatWorkoutTime("12:00:00"), "12:00 PM");
  assert.equal(formatWorkoutTime("23:59"), "11:59 PM");
  assert.equal(formatWorkoutTime("06:30:00"), "6:30 AM");
  assert.equal(formatWorkoutTime(null), "No time set");
  assert.equal(formatWorkoutTime(undefined), "No time set");
  assert.equal(formatWorkoutTime("25:30"), "Invalid time");
});
test("time validation supports saving, clearing and legacy records without a new column", () => {
  const values = { ...emptyWorkoutValues(), title: "Run", date: "2026-11-04", workout_type_id: "run" };
  assert.equal("scheduled_start_time" in validateWorkout(values, types).payload!, false);
  assert.equal(validateWorkout({ ...values, scheduled_start_time: "06:30" }, types).payload?.scheduled_start_time, "06:30");
  assert.equal(validateWorkout({ ...values, scheduled_start_time: "" }, types).payload?.scheduled_start_time, null);
  assert.ok(validateWorkout({ ...values, scheduled_start_time: "25:30" }, types).errors.scheduled_start_time);
  assert.equal(workoutToFormValues(entry()).scheduled_start_time, undefined);
  assert.equal(workoutToFormValues(entry({ scheduled_start_time: null })).scheduled_start_time, "");
  assert.equal(workoutToFormValues(entry({ scheduled_start_time: "23:59:00" })).scheduled_start_time, "23:59");
  assert.equal(workoutToFormValues(entry({ scheduled_start_time: "00:00:00" })).date, "2026-11-04");
});
test("rest days clear sport measurements while ordinary workout validation remains strict", () => {
  const values = { ...emptyWorkoutValues(), title: "Recovery", date: "2026-11-04", workout_type_id: "rest",
    distance_miles: "-2", duration_minutes: "NaN", elevation_feet: "-3", run_type: "Tempo", target_pace: "9:00" };
  const rest = validateWorkout(values, types);
  assert.deepEqual(rest.errors, {});
  for (const key of ["distance_miles", "duration_minutes", "elevation_feet", "run_type", "target_pace"] as const) assert.equal(rest.payload![key], null);
  assert.ok(validateWorkout({ ...values, workout_type_id: "run" }, types).errors.distance_miles);
  assert.ok(validateWorkout({ ...values, date: "2026-02-30" }, types).errors.date);
  assert.ok(validateWorkout({ ...values, title: "" }, types).errors.title);
});
test("rest days never change weekly/overall workout counts, mileage, or pace", () => {
  const run = entry();
  const rest = entry({ id: "rest", workout_type_id: "rest", workout_type: types[1], distance_miles: 999, duration_minutes: 1 });
  const now = new Date("2026-11-04T12:00:00");
  assert.deepEqual(calculateDashboard([run, rest], now), calculateDashboard([run], now));
  const week = calculateCalendarWeek([run, rest, entry({ id: "planned", status: "planned", distance_miles: 3 })], "2026-11-02");
  assert.equal(week.completedMiles, 5);
  assert.equal(week.scheduledMiles, 3);
  assert.equal(week.days[2].workouts.length, 3);
});
test("calendar groups multiple entries and sorts local times before untimed entries", () => {
  const workouts = [
    entry({ id: "untimed", title: "A" }),
    entry({ id: "evening", scheduled_start_time: "18:00:00" }),
    entry({ id: "morning", scheduled_start_time: "06:30:00" }),
  ];
  assert.deepEqual(calculateCalendarWeek(workouts, "2026-11-02").days[2].workouts.map((row) => row.id), ["morning", "evening", "untimed"]);
  const month = calculateCalendarMonth(workouts, "2026-11-04");
  assert.equal(month.days.length, 42);
  assert.equal(month.days[0].date, "2026-10-26");
  assert.equal(new Date(`${month.days[0].date}T12:00:00`).getDay(), 1);
  assert.equal(month.days.find((day) => day.date === "2026-11-04")?.workouts.length, 3);
  assert.equal(month.days.filter((day) => day.inMonth).length, 30);
  assert.equal(calendarMonthStart("2026-01-31"), "2026-01-01");
  assert.equal(shiftCalendarMonth("2026-01-31", 1), "2026-02-01");
  assert.equal(shiftCalendarMonth("2026-12-31", 1), "2027-01-01");
});
