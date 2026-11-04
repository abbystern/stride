import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { useWorkoutMutations, useWorkoutTypes } from "../../hooks/useWorkouts";
import {
  emptyWorkoutValues,
  RUN_TYPES,
  WORKOUT_STATUSES,
  validateWorkout,
  workoutToFormValues,
  type Workout,
  type WorkoutFieldErrors,
  type WorkoutFormValues,
} from "../../lib/workoutModel";
import { WorkoutLayout } from "./WorkoutLayout";

type Props = { workout?: Workout; mode: "create" | "edit"; initialDate?: string };

export function WorkoutForm({ workout, mode, initialDate }: Props) {
  const navigate = useNavigate();
  const { types, loading: typesLoading, error: typesError, reload: reloadTypes } = useWorkoutTypes();
  const { pending, error: mutationError, clearError, createWorkout, updateWorkout } = useWorkoutMutations();
  const [values, setValues] = useState<WorkoutFormValues>(() => ({
    ...emptyWorkoutValues(), ...(mode === "create" && initialDate ? { date: initialDate } : {}),
  }));
  const [errors, setErrors] = useState<WorkoutFieldErrors>({});
  const [initialized, setInitialized] = useState(mode === "create");

  useEffect(() => {
    if (mode === "edit" && workout && !initialized) {
      setValues(workoutToFormValues(workout));
      setInitialized(true);
    }
  }, [mode, workout, initialized]);

  const running = types.find((type) => type.id === values.workout_type_id)?.name === "Running";

  function setField<K extends keyof WorkoutFormValues>(field: K, value: WorkoutFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    clearError();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateWorkout(values, types);
    setErrors(result.errors);
    if (!result.payload) {
      const firstField = Object.keys(result.errors)[0];
      event.currentTarget.querySelector<HTMLElement>(`#${firstField}`)?.focus();
      return;
    }
    clearError();
    try {
      const saved = mode === "create"
        ? await createWorkout(result.payload)
        : await updateWorkout(workout!.id, result.payload);
      navigate(`/app/workouts/${saved.id}`, { replace: true });
    } catch {
      // Keep entered values in place so the user can retry.
    }
  }

  function fieldError(field: keyof WorkoutFormValues) {
    return errors[field] ? <p className="workout-field-error" id={`${field}-error`}>{errors[field]}</p> : null;
  }

  function commonProps(field: keyof WorkoutFormValues) {
    return {
      id: field,
      name: field,
      disabled: pending,
      required: ["title", "date", "workout_type_id", "status"].includes(field),
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": errors[field] ? `${field}-error` : undefined,
    };
  }

  if (mode === "edit" && !initialized) {
    return (
      <WorkoutLayout>
        <main className="workout-main">
          <div className="workout-state" aria-live="polite">
            <h2>Loading workout</h2>
            <p>Getting your saved details ready.</p>
            <div className="workout-skeleton"><span className="skeleton-line" /><span className="skeleton-line" /></div>
          </div>
        </main>
      </WorkoutLayout>
    );
  }

  const anyLoading = typesLoading;
  return (
    <WorkoutLayout>
      <main className="workout-main">
        <div className="workout-heading">
          <div>
            <Link to={mode === "edit" ? `/app/workouts/${workout?.id}` : "/app/workouts"} className="workout-row-meta">
              <ArrowLeft size={15} aria-hidden="true" /> {mode === "edit" ? "Back to workout" : "Workout history"}
            </Link>
            <span className="eyebrow">{mode === "edit" ? "YOUR JOURNAL" : "ADD TO YOUR JOURNAL"}</span>
            <h1>{mode === "edit" ? "Edit workout" : "Log a workout"}</h1>
            <p>Keep the details that matter to you.</p>
          </div>
        </div>

        {typesError ? (
          <section className="workout-state" role="alert">
            <h2>Activity types aren’t available</h2>
            <p>{typesError}</p>
            <button className="workout-secondary" type="button" onClick={reloadTypes}>Try again</button>
          </section>
        ) : anyLoading ? (
          <section className="workout-panel" aria-label="Loading activity types">
            <div className="workout-skeleton"><span className="skeleton-line" /><span className="skeleton-line" /></div>
            <div className="workout-skeleton"><span className="skeleton-line" /><span className="skeleton-line" /></div>
          </section>
        ) : (
          <section className="workout-panel">
            <form className="workout-form" onSubmit={submit} noValidate>
              {mutationError && <p className="form-error workout-form-error" role="alert">{mutationError}</p>}
              <div className="workout-form-grid">
                <div className="workout-field workout-field--full">
                  <label htmlFor="title">Workout title <span aria-hidden="true">*</span></label>
                  <input {...commonProps("title")} value={values.title} onChange={(e) => setField("title", e.target.value)} autoComplete="off" />
                  {fieldError("title")}
                </div>
                <div className="workout-field">
                  <label htmlFor="date">Date <span aria-hidden="true">*</span></label>
                  <input {...commonProps("date")} type="date" value={values.date} onChange={(e) => setField("date", e.target.value)} />
                  {fieldError("date")}
                </div>
                <div className="workout-field">
                  <label htmlFor="workout_type_id">Activity <span aria-hidden="true">*</span></label>
                  <select {...commonProps("workout_type_id")} value={values.workout_type_id} onChange={(e) => setField("workout_type_id", e.target.value)}>
                    <option value="">Choose an activity</option>
                    {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                  {fieldError("workout_type_id")}
                </div>
                <div className="workout-field">
                  <label htmlFor="status">Status <span aria-hidden="true">*</span></label>
                  <select {...commonProps("status")} value={values.status} onChange={(e) => setField("status", e.target.value)}>
                    {WORKOUT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                  {fieldError("status")}
                </div>
                {running && (
                  <>
                    <div className="workout-field">
                      <label htmlFor="run_type">Run type</label>
                      <select id="run_type" value={values.run_type} onChange={(e) => setField("run_type", e.target.value)}>
                        <option value="">Choose a run type</option>
                        {values.run_type && !RUN_TYPES.includes(values.run_type as (typeof RUN_TYPES)[number]) && <option value={values.run_type}>{values.run_type}</option>}
                        {RUN_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="workout-field">
                      <label htmlFor="target_pace">Target pace</label>
                      <input id="target_pace" value={values.target_pace} onChange={(e) => setField("target_pace", e.target.value)} placeholder="For example, 8:30 / mile" />
                    </div>
                  </>
                )}
                <div className="workout-field">
                  <label htmlFor="distance_miles">Distance (miles)</label>
                  <input {...commonProps("distance_miles")} type="number" inputMode="decimal" min="0" step="any" value={values.distance_miles} onChange={(e) => setField("distance_miles", e.target.value)} />
                  {fieldError("distance_miles")}
                </div>
                <div className="workout-field">
                  <label htmlFor="duration_minutes">Duration (minutes)</label>
                  <input {...commonProps("duration_minutes")} type="number" inputMode="decimal" min="0" step="any" value={values.duration_minutes} onChange={(e) => setField("duration_minutes", e.target.value)} />
                  {fieldError("duration_minutes")}
                </div>
                <div className="workout-field">
                  <label htmlFor="elevation_feet">Elevation gain (feet)</label>
                  <input {...commonProps("elevation_feet")} type="number" inputMode="decimal" min="0" step="any" value={values.elevation_feet} onChange={(e) => setField("elevation_feet", e.target.value)} />
                  {fieldError("elevation_feet")}
                </div>
                <div className="workout-field workout-field--full">
                  <label htmlFor="notes">Notes</label>
                  <textarea {...commonProps("notes")} value={values.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Anything you want to remember about this session" />
                </div>
              </div>
              <p className="workout-form-note"><span aria-hidden="true">*</span> Required fields. Leave measurements blank if you didn’t track them.</p>
              <div className="workout-form-actions">
                <button className="workout-action" type="submit" disabled={pending}>
                  <Save size={16} aria-hidden="true" /> {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save workout"}
                </button>
                <Link className="workout-secondary" to={mode === "edit" ? `/app/workouts/${workout?.id}` : "/app/workouts"}>Cancel</Link>
              </div>
            </form>
          </section>
        )}
      </main>
    </WorkoutLayout>
  );
}
