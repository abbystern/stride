import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateDashboard } from "../lib/dashboard";
import { useWorkouts, WORKOUTS_CHANGED_EVENT } from "./useWorkouts";

export function useDashboard() {
  const { workouts, loading, error, reload } = useWorkouts();
  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => {
    setNow(new Date());
    reload();
  }, [reload]);

  useEffect(() => {
    function refreshVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener(WORKOUTS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    // Covers other tabs/devices without requiring Supabase Realtime publication changes.
    // Also advances the local calendar week if the page stays open over midnight.
    const timer = window.setInterval(refreshVisible, 60_000);
    return () => {
      window.removeEventListener(WORKOUTS_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const summary = useMemo(() => calculateDashboard(workouts, now), [workouts, now]);
  return { workouts, summary, loading, error, refresh };
}
