import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import {
  getWorkout,
  insertWorkout,
  listWorkouts,
  listWorkoutTypes,
  removeWorkout,
  saveWorkout,
  workoutErrorMessage,
} from "../lib/workouts";
import type { Workout, WorkoutPayload, WorkoutType } from "../lib/workoutModel";

export const WORKOUTS_CHANGED_EVENT = "stride:workouts-changed";

function useResource<T>(
  load: (userId: string, signal: AbortSignal) => Promise<T>,
  initial: T,
) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<{ owner?: string; loader?: typeof load; data: T; loading: boolean; error: string }>({
    data: initial, loading: true, error: "",
  });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    if (!userId) return () => controller.abort();
    setState({ owner: userId, loader: load, data: initial, loading: true, error: "" });
    load(userId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ owner: userId, loader: load, data, loading: false, error: "" });
      },
      (error) => {
        if (!controller.signal.aborted) {
          setState({ owner: userId, loader: load, data: initial, loading: false, error: workoutErrorMessage(error) });
        }
      },
    );
    return () => controller.abort();
  }, [userId, load, revision, initial]);
  const current = state.owner === userId && state.loader === load;
  return {
    data: current ? state.data : initial,
    loading: !current || state.loading,
    error: current ? state.error : "",
    reload,
  };
}

const noWorkouts: Workout[] = [];
const noTypes: WorkoutType[] = [];
const loadTypes = (_userId: string, signal: AbortSignal) => listWorkoutTypes(signal);
const loadWorkouts = (userId: string, signal: AbortSignal) => listWorkouts(userId, signal);

export function useWorkoutTypes() {
  const resource = useResource(loadTypes, noTypes);
  return { types: resource.data, loading: resource.loading, error: resource.error, reload: resource.reload };
}

export function useWorkouts() {
  const resource = useResource(loadWorkouts, noWorkouts);
  return { workouts: resource.data, loading: resource.loading, error: resource.error, reload: resource.reload };
}

export function useWorkout(id: string) {
  const load = useCallback(
    (userId: string, signal: AbortSignal) => getWorkout(id, userId, signal),
    [id],
  );
  const resource = useResource<Workout | null>(load, null);
  return { workout: resource.data, loading: resource.loading, error: resource.error, reload: resource.reload };
}

export function useWorkoutMutations() {
  const { session } = useAuth();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function mutate<T>(operation: (userId: string) => Promise<T>): Promise<T> {
    if (busy.current) throw new Error("Workout request already in progress.");
    const userId = session?.user.id;
    if (!userId) throw new Error("Workout changes require you to sign in.");
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await operation(userId);
      window.dispatchEvent(new Event(WORKOUTS_CHANGED_EVENT));
      return result;
    } catch (cause) {
      const message = workoutErrorMessage(cause);
      setError(message);
      throw new Error(message);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return {
    pending,
    error,
    clearError: () => setError(""),
    createWorkout: (payload: WorkoutPayload) => mutate((userId) => insertWorkout(payload, userId)),
    updateWorkout: (id: string, payload: WorkoutPayload) => mutate((userId) => saveWorkout(id, payload, userId)),
    deleteWorkout: (id: string) => mutate((userId) => removeWorkout(id, userId)),
  };
}
