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
        .sort(compareCalendarWorkouts),
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

export function compareCalendarWorkouts(a: Workout, b: Workout): number {
  const aTime = a.scheduled_start_time?.slice(0, 5) || "99:99";
  const bTime = b.scheduled_start_time?.slice(0, 5) || "99:99";
  return aTime.localeCompare(bTime) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

export function calendarMonthStart(date: string): string {
  if (!isCalendarDate(date)) throw new Error("Choose a valid calendar date.");
  return `${date.slice(0, 7)}-01`;
}

export function shiftCalendarMonth(date: string, months: number): string {
  const value = new Date(`${calendarMonthStart(date)}T12:00:00`);
  value.setMonth(value.getMonth() + months);
  return localDateKey(value);
}

export function calculateCalendarMonth(workouts: readonly Workout[], date: string) {
  const monthStart = calendarMonthStart(date);
  const gridStart = calendarWeekStart(monthStart);
  return {
    monthStart,
    label: new Date(`${monthStart}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    days: Array.from({ length: 42 }, (_, index) => {
      const key = shiftCalendarDate(gridStart, index);
      return {
        date: key,
        inMonth: key.slice(0, 7) === monthStart.slice(0, 7),
        label: new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
        workouts: workouts.filter((workout) => workout.date === key).sort(compareCalendarWorkouts),
      };
    }),
  };
}
