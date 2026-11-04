import { useEffect, useRef, useState } from "react";
import { localDateKey } from "../lib/calendarModel";
import { listRecoveryEntries, recoveryError, saveRecoveryEntry } from "../lib/recovery";
import type { RecoveryEntry, RecoveryValues } from "../lib/recoveryModel";
import { useAuth } from "../providers/AuthProvider";
import { useResource } from "./useWorkouts";

const EMPTY: RecoveryEntry[] = [];

export function useRecoveryToday() {
  const [today, setToday] = useState(() => localDateKey());
  useEffect(() => {
    const update = () => setToday(localDateKey());
    const interval = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}

export function useRecoveryEntries() {
  const resource = useResource(listRecoveryEntries, EMPTY, recoveryError);
  return { entries: resource.data, loading: resource.loading, error: resource.error, reload: resource.reload };
}

export function useRecoverySave(date: string) {
  const { session } = useAuth();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save(values: RecoveryValues) {
    if (busy.current) throw new Error("Recovery save already in progress.");
    busy.current = true;
    setPending(true);
    setError("");
    try {
      if (!session?.user.id) throw new Error("Recovery check-ins require you to sign in.");
      return await saveRecoveryEntry(session.user.id, date, values);
    } catch (cause) {
      setError(recoveryError(cause));
      throw cause;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { save, pending, error, clearError: () => setError("") };
}
