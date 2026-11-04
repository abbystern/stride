import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { addStar, deleteStar, listStars, starsErrorMessage } from "../lib/stars";
import { useAuth } from "./AuthProvider";

type StarsContextValue = {
  starredIds: Set<string>;
  loading: boolean;
  error: string;
  pendingIds: Set<string>;
  mutationErrors: Record<string, string>;
  reload: () => void;
  toggleStar: (workoutId: string) => Promise<void>;
  forgetWorkout: (workoutId: string) => void;
};
const StarsContext = createContext<StarsContextValue | undefined>(undefined);
const emptyIds = new Set<string>();

export function StarsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const owner = useRef(userId);
  owner.current = userId;
  const generation = useRef(0);
  const busy = useRef(new Set<string>());
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    owner?: string; ids: Set<string>; loading: boolean; error: string;
  }>({ ids: emptyIds, loading: true, error: "" });
  const [pendingIds, setPendingIds] = useState(new Set<string>());
  const [mutationErrors, setMutationErrors] = useState<Record<string, string>>({});
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    busy.current.clear();
    setPendingIds(new Set());
    setMutationErrors({});
    setState({ owner: userId, ids: emptyIds, loading: true, error: "" });
    if (userId) {
      listStars(userId, controller.signal).then(
        (stars) => {
          if (!controller.signal.aborted) {
            setState({ owner: userId, ids: new Set(stars.map((star) => star.workout_id)), loading: false, error: "" });
          }
        },
        (cause) => {
          if (!controller.signal.aborted) {
            setState({ owner: userId, ids: emptyIds, loading: false, error: starsErrorMessage(cause) });
          }
        },
      );
    }
    return () => { controller.abort(); generation.current++; };
  }, [userId, revision]);

  const current = state.owner === userId;
  async function toggleStar(workoutId: string) {
    if (!userId || !current || state.loading || state.error || busy.current.has(workoutId)) return;
    const requestGeneration = generation.current;
    const wasStarred = state.ids.has(workoutId);
    busy.current.add(workoutId);
    setPendingIds(new Set(busy.current));
    setMutationErrors((errors) => ({ ...errors, [workoutId]: "" }));
    try {
      if (wasStarred) await deleteStar(userId, workoutId);
      else await addStar(userId, workoutId);
      if (owner.current === userId && generation.current === requestGeneration) {
        setState((previous) => {
          const ids = new Set(previous.ids);
          if (wasStarred) ids.delete(workoutId);
          else ids.add(workoutId);
          return { ...previous, ids };
        });
      }
    } catch (cause) {
      if (owner.current === userId && generation.current === requestGeneration) {
        setMutationErrors((errors) => ({ ...errors, [workoutId]: starsErrorMessage(cause) }));
      }
    } finally {
      if (owner.current === userId && generation.current === requestGeneration) {
        busy.current.delete(workoutId);
        setPendingIds(new Set(busy.current));
      }
    }
  }

  function forgetWorkout(workoutId: string) {
    setState((previous) => {
      const ids = new Set(previous.ids);
      ids.delete(workoutId);
      return { ...previous, ids };
    });
    setMutationErrors((errors) => {
      const next = { ...errors };
      delete next[workoutId];
      return next;
    });
  }

  return (
    <StarsContext.Provider value={{
      starredIds: current ? state.ids : emptyIds,
      loading: !current || state.loading,
      error: current ? state.error : "",
      pendingIds: current ? pendingIds : emptyIds,
      mutationErrors: current ? mutationErrors : {},
      reload, toggleStar, forgetWorkout,
    }}>
      {children}
    </StarsContext.Provider>
  );
}

export function useStars() {
  const context = useContext(StarsContext);
  if (!context) throw new Error("useStars must be used within StarsProvider.");
  return context;
}
