import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { getWeeklyGoal, goalErrorMessage, saveWeeklyGoal, type WeeklyGoal } from "../lib/weeklyGoals";

export function useWeeklyGoal(week: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const key = `${userId ?? ""}:${week}`;
  const activeKey = useRef(key);
  activeKey.current = key;
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [state, setState] = useState<{ key: string; goal: WeeklyGoal | null; loading: boolean; error: string }>({
    key: "", goal: null, loading: true, error: "",
  });
  const [saving, setSaving] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    if (!userId) return () => request.abort();
    setState({ key, goal: null, loading: true, error: "" });
    getWeeklyGoal(userId, week, request.signal).then(
      (goal) => {
        if (!request.signal.aborted && activeKey.current === key) setState({ key, goal, loading: false, error: "" });
      },
      (cause) => {
        if (!request.signal.aborted && activeKey.current === key) {
          setState({ key, goal: null, loading: false, error: goalErrorMessage(cause) });
        }
      },
    );
    return () => request.abort();
  }, [userId, week, key, revision]);

  async function save(miles: number) {
    if (!userId) throw new Error("Sign in to save a weekly goal.");
    if (busy.current) throw new Error("A goal is already being saved.");
    busy.current = true;
    setSaving(key);
    controller.current?.abort();
    try {
      const goal = await saveWeeklyGoal(userId, week, miles);
      if (activeKey.current === key) setState({ key, goal, loading: false, error: "" });
    } catch (cause) {
      const error = goalErrorMessage(cause);
      if (activeKey.current === key) setState((current) => ({ ...current, key, loading: false, error }));
      throw new Error(error);
    } finally {
      busy.current = false;
      setSaving((current) => current === key ? "" : current);
    }
  }
  const current = state.key === key;
  return {
    goal: current ? state.goal : null,
    loading: !current || state.loading,
    error: current ? state.error : "",
    pending: saving === key,
    reload,
    save,
  };
}
