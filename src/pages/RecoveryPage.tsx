import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { WorkoutLayout } from "../components/workouts/WorkoutLayout";
import { useRecoveryEntries, useRecoverySave, useRecoveryToday } from "../hooks/useRecovery";
import {
  emptyRecoveryValues,
  recoveryToValues,
  validateRecovery,
  type RecoveryEntry,
  type RecoveryValues,
} from "../lib/recoveryModel";
import { formatWorkoutDate } from "../lib/workoutModel";
import { recoveryError } from "../lib/recovery";
import { useAuth } from "../providers/AuthProvider";
import "../recovery.css";

const FIELD_LABELS: Record<keyof RecoveryValues, string> = {
  sleep_hours: "Sleep (hours)",
  energy_rating: "Energy (1–5)",
  soreness_rating: "Soreness (1–5)",
};

function RecoveryPageForDay({ date }: { date: string }) {
  const { entries, loading, error, reload } = useRecoveryEntries();
  const { pending, error: saveError, clearError, save } = useRecoverySave(date);
  const [values, setValues] = useState<RecoveryValues>(() => emptyRecoveryValues());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RecoveryValues, string>>>({});
  const [historyReady, setHistoryReady] = useState(false);
  const [savedToday, setSavedToday] = useState<RecoveryEntry | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState("");
  const initialized = useRef(false);
  const sleepRef = useRef<HTMLInputElement>(null);
  const energyRef = useRef<HTMLSelectElement>(null);
  const sorenessRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!loading && !error) {
      setHistoryReady(true);
      if (!initialized.current) {
        const today = entries.find((entry) => entry.date === date);
        initialized.current = true;
        setSavedToday(today ?? null);
        setValues(today ? recoveryToValues(today) : emptyRecoveryValues());
      }
    }
  }, [date, entries, error, loading]);

  const visibleEntries = useMemo(() => {
    const merged = entries.filter((entry) => entry.date !== savedToday?.date);
    if (savedToday) merged.push(savedToday);
    return merged.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, savedToday]);

  function updateValue(field: keyof RecoveryValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setConfirmation("");
    setFormError("");
    clearError();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmation("");
    setFormError("");
    clearError();
    const result = validateRecovery(values);
    setFieldErrors(result.errors);
    if (!result.payload) {
      const firstInvalid = (Object.keys(result.errors) as (keyof RecoveryValues)[])[0];
      if (firstInvalid === "sleep_hours") sleepRef.current?.focus();
      if (firstInvalid === "energy_rating") energyRef.current?.focus();
      if (firstInvalid === "soreness_rating") sorenessRef.current?.focus();
      return;
    }

    const wasUpdate = Boolean(savedToday);
    try {
      const entry = await save(values);
      setSavedToday(entry);
      setValues(recoveryToValues(entry));
      setFieldErrors({});
      setConfirmation(wasUpdate ? "Check-in updated." : "Check-in saved.");
      void reload();
    } catch (cause) {
      setFormError(recoveryError(cause));
    }
  }

  const todayText = formatWorkoutDate(date);

  return (
    <WorkoutLayout>
      <main className="recovery-page">
        <header className="recovery-heading">
          <div>
            <span className="recovery-kicker">Daily check-in</span>
            <h1>Recovery</h1>
            <p>A quick note on how you’re arriving today.</p>
          </div>
          <time className="recovery-today" dateTime={date}>{todayText}</time>
        </header>

        <section className="recovery-card" aria-labelledby="recovery-form-heading">
          <div className="recovery-card-heading">
            <div>
              <span className="recovery-overline">Today</span>
              <h2 id="recovery-form-heading">How are you feeling?</h2>
            </div>
            {savedToday && <span className="recovery-saved-mark">Check-in on file</span>}
          </div>

          {!historyReady && loading ? (
            <div className="recovery-loading" aria-label="Loading recovery check-in">
              <span /><span /><span />
            </div>
          ) : (
            <>
              {error && (
                <div className="recovery-alert" role="alert">
                  <div>
                    <strong>{historyReady ? "Recovery history couldn’t refresh." : "Recovery history couldn’t load."}</strong>
                    <p>{error}{!historyReady && <> If the table hasn’t been created yet, run <code>supabase/migrations/007_recovery_checkin.sql</code> in Supabase, then retry.</>}</p>
                  </div>
                  <button type="button" className="recovery-button recovery-button--quiet" onClick={reload}>Retry</button>
                </div>
              )}

              <form className="recovery-form" noValidate onSubmit={handleSubmit}>
                {Object.keys(fieldErrors).some((key) => Boolean(fieldErrors[key as keyof RecoveryValues])) && (
                  <div className="recovery-validation-summary" role="alert" aria-label="Please correct the following fields">
                    <p>Please check the following:</p>
                    <ul>
                      {(Object.keys(FIELD_LABELS) as (keyof RecoveryValues)[]).filter((key) => fieldErrors[key]).map((key) => (
                        <li key={key}>{FIELD_LABELS[key]}: {fieldErrors[key]}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="recovery-fields">
                  <div className="recovery-field">
                    <label htmlFor="recovery-sleep">{FIELD_LABELS.sleep_hours}</label>
                    <div className="recovery-input-with-unit">
                      <input
                        ref={sleepRef}
                        id="recovery-sleep"
                        name="sleep_hours"
                        type="number"
                        min="0"
                        max="24"
                        step="any"
                        inputMode="decimal"
                        required
                        value={values.sleep_hours}
                        disabled={pending || !historyReady}
                        aria-invalid={Boolean(fieldErrors.sleep_hours)}
                        aria-describedby={fieldErrors.sleep_hours ? "recovery-sleep-error" : undefined}
                        onChange={(event) => updateValue("sleep_hours", event.target.value)}
                      />
                      <span aria-hidden="true">hours</span>
                    </div>
                    {fieldErrors.sleep_hours && <p id="recovery-sleep-error" className="recovery-field-error">{fieldErrors.sleep_hours}</p>}
                  </div>

                  <div className="recovery-field">
                    <label htmlFor="recovery-energy">{FIELD_LABELS.energy_rating}</label>
                    <select
                      ref={energyRef}
                      id="recovery-energy"
                      name="energy_rating"
                      required
                      value={values.energy_rating}
                      disabled={pending || !historyReady}
                      aria-invalid={Boolean(fieldErrors.energy_rating)}
                      aria-describedby={`recovery-energy-hint${fieldErrors.energy_rating ? " recovery-energy-error" : ""}`}
                      onChange={(event) => updateValue("energy_rating", event.target.value)}
                    >
                      <option value="">Choose a rating</option>
                      {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                    </select>
                    <p id="recovery-energy-hint" className="recovery-hint">1 = low energy, 5 = high energy</p>
                    {fieldErrors.energy_rating && <p id="recovery-energy-error" className="recovery-field-error">{fieldErrors.energy_rating}</p>}
                  </div>

                  <div className="recovery-field">
                    <label htmlFor="recovery-soreness">{FIELD_LABELS.soreness_rating}</label>
                    <select
                      ref={sorenessRef}
                      id="recovery-soreness"
                      name="soreness_rating"
                      required
                      value={values.soreness_rating}
                      disabled={pending || !historyReady}
                      aria-invalid={Boolean(fieldErrors.soreness_rating)}
                      aria-describedby={`recovery-soreness-hint${fieldErrors.soreness_rating ? " recovery-soreness-error" : ""}`}
                      onChange={(event) => updateValue("soreness_rating", event.target.value)}
                    >
                      <option value="">Choose a rating</option>
                      {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                    </select>
                    <p id="recovery-soreness-hint" className="recovery-hint">1 = low soreness, 5 = high soreness</p>
                    {fieldErrors.soreness_rating && <p id="recovery-soreness-error" className="recovery-field-error">{fieldErrors.soreness_rating}</p>}
                  </div>
                </div>

                {formError && <p className="recovery-form-error" role="alert">{formError}</p>}
                {saveError && !formError && <p className="recovery-form-error" role="alert">{saveError}</p>}
                {confirmation && <p className="recovery-confirmation" role="status">{confirmation}</p>}
                <div className="recovery-form-footer">
                  <p>Your check-in is private to your account.</p>
                  <button className="recovery-button recovery-button--primary" type="submit" disabled={pending || !historyReady}>
                    {pending ? "Saving…" : savedToday ? "Update Check-In" : "Save Check-In"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        <section className="recovery-history" aria-labelledby="recovery-history-heading">
          <div className="recovery-history-heading">
            <div>
              <span className="recovery-overline">Your log</span>
              <h2 id="recovery-history-heading">Check-in history</h2>
            </div>
            {historyReady && <span className="recovery-history-count">{visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"}</span>}
          </div>

          {loading && !historyReady ? (
            <div className="recovery-history-loading" aria-label="Loading recovery history"><span /><span /><span /></div>
          ) : error && !historyReady ? (
            <div className="recovery-history-error" role="alert">
              <p>History is unavailable until it loads successfully. No entries have been assumed missing.</p>
              <button type="button" className="recovery-button recovery-button--quiet" onClick={reload}>Retry</button>
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="recovery-empty">
              <span className="recovery-empty-mark" aria-hidden="true" />
              <p>Your first check-in will appear here.</p>
            </div>
          ) : (
            <ul className="recovery-history-list">
              {visibleEntries.map((entry) => (
                <li key={entry.id} className="recovery-history-row">
                  <time dateTime={entry.date}>{formatWorkoutDate(entry.date)}</time>
                  <dl>
                    <div><dt>Sleep</dt><dd>{entry.sleep_hours} <span>hr</span></dd></div>
                    <div><dt>Energy</dt><dd>{entry.energy_rating}<span className="recovery-out-of"> / 5</span></dd></div>
                    <div><dt>Soreness</dt><dd>{entry.soreness_rating}<span className="recovery-out-of"> / 5</span></dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </WorkoutLayout>
  );
}

export default function RecoveryPage() {
  const date = useRecoveryToday();
  const { session } = useAuth();
  const owner = session?.user.id ?? "signed-out";
  return <RecoveryPageForDay key={`${owner}:${date}`} date={date} />;
}
