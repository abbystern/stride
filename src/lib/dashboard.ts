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
  let completedWorkouts = 0;
  let paceDistance = 0;
  let paceDuration = 0;
  let paceWorkoutCount = 0;

  for (const workout of workouts) {
    if (workout.status !== "completed") continue;
    const week = weeks.find((item) => workout.date >= item.weekStart && workout.date <= item.weekEnd);
    if (!week) continue;
    if (week === current) completedWorkouts++;
    if (workout.workout_type?.name !== "Running") continue;
    if (validMeasurement(workout.distance_miles)) week.miles += workout.distance_miles;
    // Use only matched distance/duration pairs; never divide by zero or use target pace.
    if (week === current &&
      validMeasurement(workout.distance_miles) && workout.distance_miles > 0 &&
      validMeasurement(workout.duration_minutes) && workout.duration_minutes > 0) {
      paceDistance += workout.distance_miles;
      paceDuration += workout.duration_minutes;
      paceWorkoutCount++;
    }
  }

  return {
    weekStart: current.weekStart,
    weekEnd: current.weekEnd,
    weeklyMileage: current.miles,
    completedWorkouts,
    averagePace: paceDistance > 0 ? paceDuration / paceDistance : null,
    paceWorkoutCount,
    weeks,
  };
}

/** Convert minutes/mile to m:ss, rounding once to handle second/minute carry. */
export function formatRunningPace(minutesPerMile: number | null): string {
  if (minutesPerMile === null || !Number.isFinite(minutesPerMile) || minutesPerMile <= 0) return "—";
  const seconds = Math.round(minutesPerMile * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
