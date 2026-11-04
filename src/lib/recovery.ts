import { supabase } from "./supabase";
import { isCalendarDate, localDateKey } from "./calendarModel";
import { validateRecovery, type RecoveryEntry, type RecoveryValues } from "./recoveryModel";

const selection = "id,user_id,date,sleep_hours,energy_rating,soreness_rating,created_at";

export function recoveryError(error: unknown): string {
  const details = error as { code?: string; message?: string };
  if (["PGRST205", "PGRST204", "42P01", "42703", "42P10"].includes(details?.code ?? "")) {
    return "Recovery check-ins aren’t set up yet. Run migration 007_recovery_checkin.sql in Supabase, then retry.";
  }
  if (details?.code === "42501") return "You can only access your own recovery check-ins. Sign in again and retry.";
  if (details?.code === "23503") return "Your account profile is unavailable. Sign in again and check that the authentication migration was applied.";
  if (["23514", "23502", "22P02", "22003"].includes(details?.code ?? "")) return "Check your sleep hours (0–24), energy (1–5), and soreness (1–5), then retry.";
  if (error instanceof Error && error.message.startsWith("Recovery ")) return error.message;
  return "We couldn’t complete the recovery request. Check your connection and try again.";
}

function client() {
  if (!supabase) throw new Error("Recovery storage isn’t connected to Supabase.");
  return supabase;
}

export async function listRecoveryEntries(userId: string, signal?: AbortSignal): Promise<RecoveryEntry[]> {
  const entries: RecoveryEntry[] = [];
  const pageSize = 500;
  while (true) {
    const query = client().from("recovery_entries").select(selection, { count: "exact" })
      .eq("user_id", userId).order("date", { ascending: false }).order("id")
      .range(entries.length, entries.length + pageSize - 1);
    const { data, error, count } = await (signal ? query.abortSignal(signal) : query)
      .overrideTypes<RecoveryEntry[], { merge: false }>();
    if (error) throw error;
    entries.push(...data);
    if (!data.length || (count !== null ? entries.length >= count : data.length < pageSize)) return entries;
  }
}

export async function saveRecoveryEntry(userId: string, date: string, values: RecoveryValues): Promise<RecoveryEntry> {
  if (!isCalendarDate(date) || date !== localDateKey()) {
    throw new Error("Recovery check-ins use today’s date. The day may have changed; refresh before saving.");
  }
  const { errors, payload } = validateRecovery(values);
  if (!payload) throw new Error(`Recovery check-in: ${Object.values(errors)[0]}`);
  const { data, error } = await client().from("recovery_entries")
    .upsert({ ...payload, user_id: userId, date }, { onConflict: "user_id,date" })
    .select(selection).single<RecoveryEntry>();
  if (error) throw error;
  return data;
}
