import { isCalendarDate } from "./calendarModel";
import { supabase } from "./supabase";
import type { Workout, WorkoutPayload, WorkoutType } from "./workoutModel";

const selection =
  // '*' returns the time when migration 006 exists, without making old-schema
  // untimed reads fail before the manual migration is applied.
  "*,workout_type:workout_types(id,name)";

export function workoutErrorMessage(error: unknown) {
  const details = error as { code?: string; message?: string };
  if ((details?.code === "PGRST204" || details?.code === "42703") &&
      details.message?.includes("scheduled_start_time")) {
    return "Workout start times aren’t set up yet. Run migration 006_calendar_improvements.sql in Supabase, then try again.";
  }
  if (details?.code === "PGRST205" || details?.code === "42P01") {
    return "Workout storage isn’t set up yet. Run migration 002_workout_database.sql in Supabase, then try again.";
  }
  if (details?.code === "42501") {
    return "You don’t have permission to make that change. Sign in again and try your own workout.";
  }
  if (details?.code === "23503") {
    return "Your profile or activity type is unavailable. Refresh and try again; check that the Supabase migrations have been applied.";
  }
  if (details?.code === "23514" || details?.code === "23502") {
    return "Some workout information is invalid. Check the required fields and measurements.";
  }
  if (error instanceof Error && error.message.startsWith("Workout ")) {
    return error.message;
  }
  return "We couldn’t complete the workout request. Check your connection and try again.";
}

function client() {
  if (!supabase) throw new Error("Workout storage isn’t connected to Supabase.");
  return supabase;
}

function requireId(id: string) {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
    throw new Error("Workout not found or unavailable to your account.");
  }
}

export async function listWorkoutTypes(signal?: AbortSignal): Promise<WorkoutType[]> {
  const query = client().from("workout_types").select("id,name").order("name");
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  if (!data.length) {
    throw new Error("Workout activity types are missing. Run migration 002_workout_database.sql in Supabase.");
  }
  return data;
}

export async function listWorkouts(userId: string, signal?: AbortSignal): Promise<Workout[]> {
  // Search must include records beyond Supabase's default response-size cap.
  // Exact RLS-scoped counts also handle projects with a smaller per-query cap.
  const workouts: Workout[] = [];
  const pageSize = 500;
  while (true) {
    const query = client()
      .from("workouts")
      .select(selection, { count: "exact" })
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(workouts.length, workouts.length + pageSize - 1);
    const { data, count, error } = await (signal ? query.abortSignal(signal) : query)
      .overrideTypes<Workout[], { merge: false }>();
    if (error) throw error;
    workouts.push(...data);
    if (
      data.length === 0 ||
      (count !== null ? workouts.length >= count : data.length < pageSize)
    ) return workouts;
  }
}

export async function getWorkout(id: string, userId: string, signal?: AbortSignal): Promise<Workout | null> {
  requireId(id);
  const query = client().from("workouts").select(selection).eq("id", id).eq("user_id", userId);
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
    .maybeSingle<Workout>();
  if (error) throw error;
  return data;
}

export async function insertWorkout(payload: WorkoutPayload, userId: string): Promise<Workout> {
  const { data, error } = await client().from("workouts")
    .insert({ ...payload, user_id: userId }).select(selection).single<Workout>();
  if (error) throw error;
  return data;
}

export async function saveWorkout(id: string, payload: WorkoutPayload, userId: string): Promise<Workout> {
  requireId(id);
  const { data, error } = await client().from("workouts").update(payload)
    .eq("id", id).eq("user_id", userId).select(selection).maybeSingle<Workout>();
  if (error) throw error;
  if (!data) throw new Error("Workout not found or unavailable to your account. Your changes weren’t saved.");
  return data;
}

export async function removeWorkout(id: string, userId: string): Promise<void> {
  requireId(id);
  const { data, error } = await client().from("workouts").delete()
    .eq("id", id).eq("user_id", userId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Workout not found or unavailable to your account. Nothing was deleted.");
}

export async function rescheduleWorkout(id: string, date: string, userId: string): Promise<Workout> {
  requireId(id);
  if (!isCalendarDate(date)) throw new Error("Choose a valid workout date.");
  const { data, error } = await client().from("workouts").update({ date })
    .eq("id", id).eq("user_id", userId).select(selection).maybeSingle<Workout>();
  if (error) throw error;
  if (!data) throw new Error("Workout not found or unavailable to your account. The date wasn't changed.");
  return data;
}
