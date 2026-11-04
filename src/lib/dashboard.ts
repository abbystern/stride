import type { Workout } from "./workoutModel";

export type DashboardWorkout = Pick<Workout,
  "date" | "status" | "distance_miles" | "duration_minutes" | "workout_type"
>;

export type MileageWeek = {
  weekStart: string;
  weekEnd: string;
  label: string;
  miles: number;
};

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shifted(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatWeekDate(key: string): string {
  // Database dates are calendar dates, not UTC timestamps.
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function validMeasurement(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function emptyTotals() {
  return { runningMileage: 0, completedWorkouts: 0, paceWorkoutCount: 0, paceDistanceMiles: 0, paceDurationMinutes: 0 };
}

/** Called only for completed entries; weekly and overall use identical eligibility. */
function addCompletedWorkout(totals: ReturnType<typeof emptyTotals>, workout: DashboardWorkout) {
  if (workout.workout_type?.name === "Rest Day") return;
  totals.completedWorkouts++;
  if (workout.workout_type?.name !== "Running") return;
  if (validMeasurement(workout.distance_miles)) totals.runningMileage += workout.distance_miles;
  if (validMeasurement(workout.distance_miles) && workout.distance_miles > 0 &&
    validMeasurement(workout.duration_minutes) && workout.duration_minutes > 0) {
    totals.paceDistanceMiles += workout.distance_miles;
    totals.paceDurationMinutes += workout.duration_minutes;
    totals.paceWorkoutCount++;
  }
}

function finishTotals(totals: ReturnType<typeof emptyTotals>) {
  return {
    ...totals,
    averagePace: totals.paceDistanceMiles > 0 ? totals.paceDurationMinutes / totals.paceDistanceMiles : null,
  };
}

/** Uses the browser's local calendar; now can be injected for deterministic tests. */
export function calculateDashboard(workouts: readonly DashboardWorkout[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const monday = shifted(today, -((today.getDay() + 6) % 7));
  const weeks: MileageWeek[] = Array.from({ length: 6 }, (_, index) => {
    const start = shifted(monday, (index - 5) * 7);
    const weekStart = dateKey(start);
    return {
      weekStart,
      weekEnd: dateKey(shifted(start, 6)),
      label: formatWeekDate(weekStart),
      miles: 0,
    };
  });
  const current = weeks[5];
  const weekly = emptyTotals();
  const overall = emptyTotals();

  for (const workout of workouts) {
    if (workout.status !== "completed") continue;
    // Overall includes every date, including entries older than the chart window.
    addCompletedWorkout(overall, workout);
    const week = weeks.find((item) => workout.date >= item.weekStart && workout.date <= item.weekEnd);
    if (!week) continue;
    if (week === current) addCompletedWorkout(weekly, workout);
    if (workout.workout_type?.name !== "Running") continue;
    if (validMeasurement(workout.distance_miles)) week.miles += workout.distance_miles;
  }

  const weeklyStats = finishTotals(weekly);
  return {
    weekStart: current.weekStart,
    weekEnd: current.weekEnd,
    weeklyMileage: current.miles,
    completedWorkouts: weeklyStats.completedWorkouts,
    averagePace: weeklyStats.averagePace,
    paceWorkoutCount: weeklyStats.paceWorkoutCount,
    paceDistanceMiles: weeklyStats.paceDistanceMiles,
    paceDurationMinutes: weeklyStats.paceDurationMinutes,
    overall: finishTotals(overall),
    weeks,
  };
}

/** Convert minutes/mile to m:ss, rounding once to handle second/minute carry. */
export function formatRunningPace(minutesPerMile: number | null): string {
  if (minutesPerMile === null || !Number.isFinite(minutesPerMile) || minutesPerMile <= 0) return "—";
  const seconds = Math.round(minutesPerMile * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
