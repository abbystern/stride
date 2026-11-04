import { useCallback, useRef, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useResource, WORKOUTS_CHANGED_EVENT } from "./useWorkouts";
import { getStrengthSession, listStrengthTemplates, saveStrengthProgress, saveStrengthTemplate, startStrengthWorkout, strengthError } from "../lib/strength";
import type { ExerciseDraft, SetDraft, StrengthSession, StrengthTemplate } from "../lib/strengthModel";
const EMPTY_TEMPLATES: StrengthTemplate[] = [];
export function useStrengthTemplates() {
  const resource = useResource(listStrengthTemplates, EMPTY_TEMPLATES, strengthError);
  return { templates: resource.data, loading: resource.loading, error: resource.error, reload: resource.reload };
}
export function useStrengthSession(id: string) {
  const load = useCallback((owner: string, signal: AbortSignal) => getStrengthSession(id, owner, signal), [id]);
  const resource = useResource<StrengthSession | null>(load, null, strengthError);
  return { session: resource.data, loading: resource.loading, error: resource.error, reload: resource.reload };
}
export function useStrengthActions() {
  const { session } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function run<T>(operation: () => Promise<T>) {
    if (!session) throw new Error("Sign in to save strength workouts.");
    if (busy.current) throw new Error("Wait for the current save to finish.");
    busy.current = true; setPending(true); setError("");
    try {
      const result = await operation();
      window.dispatchEvent(new Event(WORKOUTS_CHANGED_EVENT));
      return result;
    } catch (cause) {
      const message = strengthError(cause); setError(message); throw new Error(message);
    } finally { busy.current = false; setPending(false); }
  }
  return {
    pending, error, clearError: () => setError(""),
    saveTemplate: (id: string | null, name: string, entries: ExerciseDraft[]) => run(() => saveStrengthTemplate(id, name, entries)),
    startWorkout: (templateId: string, date: string, workoutId?: string) => run(() => startStrengthWorkout(templateId, date, workoutId ?? null)),
    saveProgress: (id: string, drafts: SetDraft[], finish = false) => run(() => saveStrengthProgress(id, drafts, finish)),
  };
}
