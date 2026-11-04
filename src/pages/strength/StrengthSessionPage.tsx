import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Save } from "lucide-react";
import { WorkoutLayout } from "../../components/workouts/WorkoutLayout";
import { useStrengthActions, useStrengthSession, useStrengthTemplates } from "../../hooks/useStrength";
import { useAuth } from "../../providers/AuthProvider";
import { formatWorkoutDate } from "../../lib/workoutModel";
import { setToDraft, validateSetDrafts } from "../../lib/strengthModel";
import type { SetDraft, StrengthSet } from "../../lib/strengthModel";
import "../../strength.css";

function StrengthSessionContent() {
  const { id = "" } = useParams();
  const { session: auth } = useAuth();
  const owner = auth?.user.id ?? "signed-out";
  return <StrengthSessionForWorkout key={`${owner}:${id}`} id={id} />;
}

function StrengthSessionForWorkout({ id }: { id: string }) {
  const { session, loading, error, reload } = useStrengthSession(id);
  const { templates, loading: templatesLoading, error: templatesError, reload: reloadTemplates } = useStrengthTemplates();
  const { pending, error: actionError, clearError, saveProgress, startWorkout } = useStrengthActions();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<SetDraft[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const baseline = useRef("");
  const didInit = useRef(false);

  useEffect(() => {
    if (!session || didInit.current) return;
    const initial = session.sets.map(setToDraft);
    setDrafts(initial);
    baseline.current = JSON.stringify(initial);
    didInit.current = true;
    setInitialized(true);
  }, [session]);

  const dirty = initialized && JSON.stringify(drafts) !== baseline.current;
  const completed = session?.workout.status === "completed";
  useEffect(() => {
    if (!dirty || completed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, completed]);

  const groups = useMemo(() => {
    const sets = session?.sets ?? [];
    const grouped = new Map<string, StrengthSet[]>();
    for (const set of sets) {
      const key = `${set.position}:${set.exercise_id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), set]);
    }
    return [...grouped.values()].map((items) => items.sort((a, b) => a.set_number - b.set_number));
  }, [session?.sets]);

  function patchDraft(id: string, field: "weight_lbs" | "reps" | "completed", value: string | boolean) {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, [field]: value } : draft));
    setSavedMessage("");
    setValidationError("");
    clearError();
  }

  async function save(finish = false) {
    if (!session) return;
    const validation = validateSetDrafts(drafts, finish);
    if (validation) { setSavedMessage(""); setValidationError(validation); return; }
    setValidationError("");
    if (finish && !window.confirm("Finish this workout? Any unfinished sets will remain uncompleted.")) return;
    clearError();
    setSavedMessage("");
    try {
      await saveProgress(id, drafts, finish);
      baseline.current = JSON.stringify(drafts);
      setSavedMessage(finish ? "Workout finished and all entered progress was saved." : "Progress saved.");
      if (finish) reload();
    } catch {
      // The draft stays local so no entered values are lost.
    }
  }

  async function useSelectedTemplate() {
    if (!session || !selectedTemplate) return;
    clearError(); setStartError(""); setStarting(true);
    try {
      const workoutId = await startWorkout(selectedTemplate, session.workout.date, id);
      didInit.current = false;
      setInitialized(false);
      navigate(`/app/workouts/${workoutId}/strength`, { replace: true });
      if (workoutId === id) reload();
    } catch { setStartError("The template could not be applied. The scheduled workout details are unchanged; retry when ready."); }
    finally { setStarting(false); }
  }

  return (
    <WorkoutLayout>
      <main className="strength-page">
        <p style={{ margin: "0 0 20px" }}><Link to={`/app/workouts/${id}`} className="workout-row-meta"><ArrowLeft size={15} aria-hidden="true" /> Workout details</Link></p>
        {loading ? <section className="strength-panel" aria-label="Loading strength session"><div className="strength-loading"><span className="strength-skeleton" /><span className="strength-skeleton" /><span className="strength-skeleton" /></div></section> :
          error ? <section className="strength-panel" role="alert"><h2>Strength session couldn’t load</h2><p>{error}</p><p className="strength-meta">Your workout remains unchanged. Retry the load; if setup is missing, the message will name the required migration.</p><button type="button" className="strength-button" onClick={reload}>Try again</button></section> :
          !session ? <section className="strength-panel"><h2>Workout unavailable</h2><p className="strength-meta">This workout may have been removed or may not be available to your account.</p><Link className="strength-button" to="/app/workouts">Workout history</Link></section> :
          <>
            <header className="strength-hero">
              <div><span className="strength-kicker">Strength session · {session.workout.status === "completed" ? "Complete" : "In progress"}</span><h1 className="strength-workout-title">{session.workout.title}</h1><p className="strength-meta">{formatWorkoutDate(session.workout.date)}{session.workout.notes ? ` · ${session.workout.notes}` : ""}</p></div>
            </header>
            {actionError && <div className="strength-banner" role="alert"><p>{actionError}</p></div>}
            {validationError && <div className="strength-banner" role="alert"><p>{validationError}</p></div>}
            {session.sets.length === 0 ? (
              completed ? (
                <section className="strength-panel">
                  <h2>No set records</h2>
                  <p className="strength-meta" style={{ marginTop: 9 }}>This completed Strength Training workout has no saved set records. Results cannot be reconstructed, so nothing is being generated. You can review its details or create a template for a future workout.</p>
                  <div className="strength-template-actions" style={{ marginTop: 16 }}><Link className="strength-button" to={`/app/workouts/${id}`}>Workout details</Link><Link className="strength-button strength-button--primary" to="/app/strength">Browse templates</Link></div>
                </section>
              ) : (
                <section className="strength-panel">
                  <div className="strength-panel-head"><h2>Choose a strength template</h2></div>
                  <p className="strength-meta" style={{ margin: "0 0 17px" }}>This scheduled Strength Training workout has no set plan yet. Applying a template adds its set plan to this workout while preserving the existing title, date, and notes.</p>
                  {templatesError && <div className="strength-banner" role="alert"><p>{templatesError}</p><button type="button" className="strength-button" onClick={reloadTemplates}>Retry templates</button></div>}
                  {templates.length ? <>
                    <label className="strength-field">Strength template
                      <select aria-label="Strength template" value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)} disabled={templatesLoading}>
                        <option value="">Choose a template</option>
                        {templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}
                      </select>
                    </label>
                    {startError && <p className="strength-banner" role="alert">{startError}</p>}
                    <button type="button" className="strength-button strength-button--primary" style={{ marginTop: 14 }} disabled={!selectedTemplate || starting} onClick={useSelectedTemplate}>{starting ? "Applying template…" : "Use template"}</button>
                  </> : templatesLoading ? <div className="strength-skeleton" aria-label="Loading templates" /> :
                    <div className="strength-empty"><strong>No templates available</strong>Create a routine first, then return here to add its set plan.<p style={{ margin: "12px 0 0" }}><Link to="/app/strength" className="strength-button strength-button--primary">Open strength templates</Link></p></div>}
                </section>
              )
            ) : (
              <>
                <section className="strength-panel">
                  {groups.map((exerciseSets) => {
                    const first = exerciseSets[0];
                    const previous = session.previous.find((item) => item.exercise_id === first.exercise_id);
                    return <div className="strength-exercise-group" key={`${first.position}:${first.exercise_id}`}>
                      <div className="strength-exercise-heading"><div><h3>{first.exercise_name}</h3><p className="strength-target">Target: {first.target_sets} sets · {first.rep_min}–{first.rep_max} reps</p></div></div>
                      {first.notes && <p className="strength-notes">{first.notes}</p>}
                      {previous ? <div className="strength-previous"><strong>Previous · {formatWorkoutDate(previous.date)}</strong>{previous.sets.map((set) => `Set ${set.set_number}: ${set.weight_lbs} lb × ${set.reps} reps`).join("  ·  ")}</div> :
                        <div className="strength-previous strength-previous--none">No previous completed performance.</div>}
                      <div className="strength-set-table">
                        {exerciseSets.map((set) => {
                          const draft = drafts.find((entry) => entry.id === set.id);
                          return <div className="strength-set-row" key={set.id}>
                            <span className="strength-set-label">Set {set.set_number}</span>
                            <label><span className="strength-unit-label">Weight · lb</span><input className="strength-set-input" type="number" min="0" step="any" inputMode="decimal" aria-label={`${set.exercise_name} set ${set.set_number} weight`} value={draft?.weight_lbs ?? ""} readOnly={completed} onChange={(event) => patchDraft(set.id, "weight_lbs", event.target.value)} /></label>
                            <label><span className="strength-unit-label">Reps</span><input className="strength-set-input" type="number" min="0" max="1000" step="1" inputMode="numeric" aria-label={`${set.exercise_name} set ${set.set_number} reps`} value={draft?.reps ?? ""} readOnly={completed} onChange={(event) => patchDraft(set.id, "reps", event.target.value)} /></label>
                            <label className="strength-check"><input type="checkbox" aria-label={`${set.exercise_name} set ${set.set_number} completed`} checked={draft?.completed ?? false} disabled={completed} onChange={(event) => patchDraft(set.id, "completed", event.target.checked)} /> Completed</label>
                          </div>;
                        })}
                      </div>
                    </div>;
                  })}
                  {completed ? <div className="strength-banner strength-banner--info" style={{ marginTop: 14 }}><p>Completed results are read-only. Previous performance is shown from an earlier completed session.</p></div> :
                    <div className="strength-savebar">
                      <span className={`strength-save-status${dirty ? " strength-save-status--dirty" : ""}`} role="status">
                        {dirty ? "Unsaved changes. Save before refreshing this page." : savedMessage || "All changes saved."}
                      </span>
                      <div className="strength-template-actions">
                        <button type="button" className="strength-button" disabled={pending || !dirty} onClick={() => save(false)}><Save size={15} /> {pending ? "Saving…" : "Save progress"}</button>
                        <button type="button" className="strength-button strength-button--primary" disabled={pending} onClick={() => save(true)}><Check size={15} /> Finish workout</button>
                      </div>
                    </div>}
                </section>
                {!completed && <p className="strength-meta">Save progress before you refresh or leave. Finishing saves entered drafts and workout status together; unfinished sets remain uncompleted.</p>}
              </>
            )}
          </>
        }
      </main>
    </WorkoutLayout>
  );
}

export default StrengthSessionContent;
