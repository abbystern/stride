import { supabase } from "./supabase";

export type Star = { id: string; workout_id: string };

function client() {
  if (!supabase) throw new Error("Favorites aren’t connected to Supabase.");
  return supabase;
}

export function starsErrorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  if (code === "PGRST205" || code === "42P01") {
    return "Favorites aren’t set up yet. Run 003_stars.sql in Supabase SQL Editor, then try again.";
  }
  if (code === "42501") {
    return "You can only star workouts you own. Sign in again if your session has expired.";
  }
  if (code === "23503") {
    return "That workout or your profile is no longer available. Refresh the page and try again.";
  }
  return "We couldn’t update or load your favorites. Check your connection and try again.";
}

export async function listStars(userId: string, signal: AbortSignal): Promise<Star[]> {
  const { data, error } = await client().from("stars")
    .select("id,workout_id").eq("user_id", userId).abortSignal(signal);
  if (error) throw error;
  return data;
}

export async function addStar(userId: string, workoutId: string): Promise<void> {
  const { error } = await client().from("stars").upsert(
    { user_id: userId, workout_id: workoutId },
    { onConflict: "user_id,workout_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function deleteStar(userId: string, workoutId: string): Promise<void> {
  const { error } = await client().from("stars").delete()
    .eq("user_id", userId).eq("workout_id", workoutId);
  if (error) throw error;
}
