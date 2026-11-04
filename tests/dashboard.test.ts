import assert from "node:assert/strict";
import test from "node:test";
import { calculateDashboard, formatRunningPace } from "../src/lib/dashboard.ts";
import type { DashboardWorkout } from "../src/lib/dashboard.ts";

const wednesday = new Date(2026, 10, 4, 12);
function run(distance: number | null, overrides: Partial<DashboardWorkout> = {}): DashboardWorkout {
  return {
    date: "2026-11-04", status: "completed",
    workout_type: { id: "running", name: "Running" },
    distance_miles: distance, duration_minutes: distance === null ? null : distance * 10,
    ...overrides,
  };
}

test("required dashboard test: completed runs of 4 + 5 + 6 miles, excluding a planned 8-mile run, total 15 miles", () => {
  const workouts = [run(4), run(5), run(6), run(8, { status: "planned" })];
  const dashboard = calculateDashboard(workouts, wednesday);
  assert.equal(dashboard.weeklyMileage, 15);
  assert.equal(dashboard.weeks[5].miles, 15);
});

test("only completed Running contributes mileage; completed counts include all activities", () => {
  const workouts = [
    run(4), run(5, { status: "planned" }), run(6, { status: "in_progress" }),
    ...["Hiking", "Walking", "Cycling", "Strength Training", "Pilates", "Physical Therapy", "Other"].map(
      (name) => run(8, { workout_type: { id: name, name } }),
    ),
    run(9, { workout_type: null }),
  ];
  const result = calculateDashboard(workouts, wednesday);
  assert.equal(result.weeklyMileage, 4);
  assert.equal(result.completedWorkouts, 9);
  assert.equal(result.averagePace, 10);
});

test("calendar week is Monday through Sunday, including both boundaries but not adjacent weeks", () => {
  const result = calculateDashboard([
    run(2, { date: "2026-11-01" }), run(4, { date: "2026-11-02" }),
    run(6, { date: "2026-11-08" }), run(8, { date: "2026-11-09" }),
  ], wednesday);
  assert.equal(result.weekStart, "2026-11-02");
  assert.equal(result.weekEnd, "2026-11-08");
  assert.equal(result.weeklyMileage, 10);
  assert.equal(result.completedWorkouts, 2);
  assert.equal(result.weeks[4].miles, 2);
});

test("pace uses total valid duration / total valid distance, not mean individual paces", () => {
  const result = calculateDashboard([run(1, { duration_minutes: 6 }), run(3, { duration_minutes: 30 })], wednesday);
  assert.equal(result.averagePace, 9);
  assert.equal(result.paceWorkoutCount, 2);
  assert.equal(formatRunningPace(result.averagePace), "9:00");
});

test("pace regression: a completed 5-mile run in 50 minutes gives 10:00/mi", () => {
  const result = calculateDashboard([run(5, { duration_minutes: 50 })], wednesday);
  assert.equal(result.averagePace, 10);
  assert.equal(formatRunningPace(result.averagePace), "10:00");
  assert.equal(result.paceWorkoutCount, 1);
});

test("pace regression: adding a 2-mile walk in 40 minutes does not change running pace or chart mileage", () => {
  const result = calculateDashboard([
    run(5, { duration_minutes: 50 }),
    run(2, { duration_minutes: 40, workout_type: { id: "walking", name: "Walking" } }),
  ], wednesday);
  assert.equal(formatRunningPace(result.averagePace), "10:00");
  assert.equal(result.averagePace, 10);
  assert.equal(result.paceWorkoutCount, 1);
  assert.equal(result.weeklyMileage, 5);
  assert.equal(result.weeks[5].miles, 5);
  assert.equal(result.completedWorkouts, 2);
});

test("pace regression: adding planned and in-progress runs cannot change actual pace or mileage", () => {
  const result = calculateDashboard([
    run(5, { duration_minutes: 50 }),
    run(8, { duration_minutes: 32, status: "planned" }),
    run(3, { duration_minutes: 12, status: "in_progress" }),
  ], wednesday);
  assert.equal(result.averagePace, 10);
  assert.equal(formatRunningPace(result.averagePace), "10:00");
  assert.equal(result.paceWorkoutCount, 1);
  assert.equal(result.weeklyMileage, 5);
  assert.equal(result.weeks[5].miles, 5);
  assert.equal(result.completedWorkouts, 1);
});

test("pace regression: 5 miles in 50 minutes plus 3 miles in 27 minutes gives 9:38/mi", () => {
  const result = calculateDashboard([
    run(5, { duration_minutes: 50 }), run(3, { duration_minutes: 27 }),
  ], wednesday);
  assert.equal(result.averagePace, 77 / 8);
  assert.equal(result.paceWorkoutCount, 2);
  assert.equal(result.paceDurationMinutes, 77);
  assert.equal(result.paceDistanceMiles, 8);
  assert.equal(formatRunningPace(result.averagePace), "9:38");
});

test("pace regression: every non-running activity with a different pace is excluded in all chart weeks", () => {
  const otherActivities = ["Walking", "Hiking", "Cycling", "Strength Training", "Pilates", "Physical Therapy", "PT", "Other"];
  const workouts = [run(5, { duration_minutes: 50 })];
  for (const name of otherActivities) {
    // Deliberately use 20 min/mi, not the run's 10 min/mi, to detect contamination.
    workouts.push(run(2, { duration_minutes: 40, workout_type: { id: name, name } }));
    workouts.push(run(2, { date: "2026-10-26", duration_minutes: 40, workout_type: { id: name, name } }));
  }
  workouts.push(run(2, { duration_minutes: 40, workout_type: null }));
  const result = calculateDashboard(workouts, wednesday);
  assert.equal(result.averagePace, 10);
  assert.equal(result.paceWorkoutCount, 1);
  assert.deepEqual(result.weeks.map((week) => week.miles), [0, 0, 0, 0, 0, 5]);
});

test("pace regression: no eligible runs displays a dash for every missing, zero, or invalid measurement pair", () => {
  const ineligible = [
    ...[null, 0, -1, NaN, Infinity, -Infinity].map((distance) => run(distance, { duration_minutes: 40 })),
    ...[null, 0, -1, NaN, Infinity, -Infinity].map((duration) => run(2, { duration_minutes: duration })),
    run(5, { status: "planned" }), run(5, { status: "in_progress" }),
    run(2, { duration_minutes: 40, workout_type: { id: "walking", name: "Walking" } }),
  ];
  const result = calculateDashboard(ineligible, wednesday);
  assert.equal(result.averagePace, null);
  assert.equal(result.paceWorkoutCount, 0);
  assert.equal(result.paceDistanceMiles, 0);
  assert.equal(result.paceDurationMinutes, 0);
  assert.equal(formatRunningPace(result.averagePace), "—");
});

test("pace excludes incomplete measurement pairs, zeroes, invalid values, other weeks and activities", () => {
  const result = calculateDashboard([
    run(4, { duration_minutes: 39 }), run(5, { duration_minutes: null }),
    run(null, { duration_minutes: 20 }), run(0, { duration_minutes: 20 }),
    run(3, { duration_minutes: 0 }), run(-1), run(NaN), run(Infinity),
    run(2, { duration_minutes: -5 }), run(2, { duration_minutes: Infinity }),
    run(100, { date: "2026-10-26" }),
  ], wednesday);
  assert.equal(result.averagePace, 9.75);
  assert.equal(formatRunningPace(result.averagePace), "9:45");
  assert.equal(result.paceWorkoutCount, 1);
  assert.equal(result.weeklyMileage, 16);
});

test("six bins include current plus five earlier weeks and retain empty weeks", () => {
  const result = calculateDashboard([
    run(2, { date: "2026-09-28" }), run(3, { date: "2026-10-11" }),
    run(99, { date: "2026-09-27" }), run(99, { date: "2026-11-09" }),
  ], wednesday);
  assert.equal(result.weeks.length, 6);
  assert.deepEqual(result.weeks.map((week) => week.weekStart), [
    "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02",
  ]);
  assert.deepEqual(result.weeks.map((week) => week.miles), [2, 3, 0, 0, 0, 0]);
});

test("empty and planned-only weeks have zero totals and no misleading pace", () => {
  for (const workouts of [[], [run(8, { status: "planned" })], [run(null)]]) {
    const result = calculateDashboard(workouts, wednesday);
    assert.equal(result.weeklyMileage, 0);
    assert.equal(result.averagePace, null);
    assert.equal(formatRunningPace(result.averagePace), "—");
  }
  assert.equal(calculateDashboard([], wednesday).completedWorkouts, 0);
});

test("Sunday, year transitions, and daylight-saving calendar weeks use local dates", () => {
  assert.equal(calculateDashboard([], new Date(2026, 10, 1, 23, 59)).weekStart, "2026-10-26");
  const year = calculateDashboard([run(4, { date: "2027-01-01" })], new Date(2027, 0, 1));
  assert.equal(year.weekStart, "2026-12-28");
  assert.equal(year.weekEnd, "2027-01-03");
  assert.equal(year.weeklyMileage, 4);
  const dst = calculateDashboard([run(5, { date: "2026-03-08" })], new Date(2026, 2, 8, 23, 59));
  assert.equal(dst.weekStart, "2026-03-02");
  assert.equal(dst.weekEnd, "2026-03-08");
  assert.equal(dst.weeklyMileage, 5);
});

test("pace formatting rounds once and carries seconds into the next minute", () => {
  assert.equal(formatRunningPace(9 + 59.9 / 60), "10:00");
  assert.equal(formatRunningPace(8.5), "8:30");
  for (const value of [null, 0, -1, NaN, Infinity]) assert.equal(formatRunningPace(value), "—");
});

test("calculation does not modify its input workouts or reference date", () => {
  const workouts = Object.freeze([Object.freeze(run(4)), Object.freeze(run(5))]);
  const now = new Date(wednesday);
  calculateDashboard(workouts, now);
  assert.equal(now.getTime(), wednesday.getTime());
  assert.equal(workouts[0].distance_miles, 4);
});
