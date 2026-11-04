import type { Workout } from "./workoutModel";

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDateKey(date) === value;
}

export function shiftCalendarDate(value: string, days: number): string {
  if (!isCalendarDate(value)) throw new Error("Choose a valid calendar date.");
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function calendarWeekStart(value = localDateKey()): string {
  if (!isCalendarDate(value)) throw new Error("Choose a valid calendar date.");
  const date = new Date(`${value}T12:00:00`);
  return shiftCalendarDate(value, -((date.getDay() + 6) % 7));
}

export function validateMileageGoal(input: string): { value: number | null; error: string } {
  const value = input.trim() === "" ? NaN : Number(input);
  if (!Number.isFinite(value) || value < 0) {
    return { value: null, error: "Enter a weekly goal of zero or more miles." };
  }
  return { value, error: "" };
}

export function calculateCalendarWeek(workouts: readonly Workout[], weekStart: string) {
  if (calendarWeekStart(weekStart) !== weekStart) throw new Error("The week must start on Monday.");
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftCalendarDate(weekStart, index);
    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
      workouts: workouts.filter((workout) => workout.date === date)
        .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id)),
    };
  });
  let scheduledMiles = 0;
  let completedMiles = 0;
  for (const { workouts: entries } of days) {
    for (const entry of entries) {
      if (entry.workout_type?.name !== "Running" || entry.distance_miles === null ||
        !Number.isFinite(entry.distance_miles) || entry.distance_miles < 0) continue;
      if (entry.status === "completed") completedMiles += entry.distance_miles;
      if (entry.status === "planned" || entry.status === "in_progress") scheduledMiles += entry.distance_miles;
    }
  }
  return { days, scheduledMiles, completedMiles };
}
