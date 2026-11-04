import { supabase } from "./supabase";
import { calendarWeekStart, validateMileageGoal } from "./calendarModel";

export type WeeklyGoal = { id: string; user_id: string; week_start: string; target_miles: number };

function client() {
  if (!supabase) throw new Error("Connect Supabase before saving weekly goals.");
  return supabase;
}

function requireMonday(week: string) {
  if (calendarWeekStart(week) !== week) throw new Error("Choose a week starting on Monday.");
}

export function goalErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "PGRST205" || code === "42P01") {
    return "Weekly goals aren't set up yet. Run migration 004_training_calendar.sql in Supabase, then retry.";
  }
  if (code === "42501") return "You don't have permission to access this goal. Please sign in again.";
  if (code === "23514") return "Enter a nonnegative mileage goal for a week starting on Monday.";
  if (error instanceof Error && !/fetch|network|request/i.test(error.message)) return error.message;
  return "We couldn't load or save your weekly goal. Check your connection and try again.";
}

export async function getWeeklyGoal(userId: string, week: string, signal?: AbortSignal): Promise<WeeklyGoal | null> {
  requireMonday(week);
  const query = client().from("weekly_goals").select("id,user_id,week_start,target_miles")
    .eq("user_id", userId).eq("week_start", week);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle()
    .overrideTypes<WeeklyGoal | null, { merge: false }>();
  if (error) throw error;
  return data;
}

export async function saveWeeklyGoal(userId: string, week: string, miles: number): Promise<WeeklyGoal> {
  requireMonday(week);
  if (validateMileageGoal(String(miles)).error) throw new Error("Enter a weekly goal of zero or more miles.");
  const { data, error } = await client().from("weekly_goals")
    .upsert({ user_id: userId, week_start: week, target_miles: miles }, { onConflict: "user_id,week_start" })
    .select("id,user_id,week_start,target_miles").single()
    .overrideTypes<WeeklyGoal, { merge: false }>();
  if (error) throw error;
  return data;
}
