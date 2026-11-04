import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Dumbbell, Pencil, Play } from "lucide-react";
import { WorkoutLayout } from "../../components/workouts/WorkoutLayout";
import { TemplateForm } from "../../components/strength/TemplateForm";
import { useStrengthActions, useStrengthTemplates } from "../../hooks/useStrength";
import { useAuth } from "../../providers/AuthProvider";
import { localDateKey } from "../../lib/calendarModel";
import type { ExerciseDraft, StrengthTemplate } from "../../lib/strengthModel";
import "../../strength.css";

function TemplateLibrary() {
  const { session } = useAuth();
  const owner = session?.user.id ?? "signed-out";
  return <TemplateLibraryForOwner key={owner} />;
}

function TemplateLibraryForOwner() {
  const { templates, loading, error, reload } = useStrengthTemplates();
  const { pending, error: actionError, clearError, startWorkout } = useStrengthActions();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<StrengthTemplate | null | undefined>(undefined);
  const [startDate, setStartDate] = useState(localDateKey());
  const [startingId, setStartingId] = useState("");
  const [startError, setStartError] = useState("");

  async function start(template: StrengthTemplate) {
    clearError();
    setStartError("");
    setStartingId(template.id);
    try {
      const id = await startWorkout(template.id, startDate);
      navigate(`/app/workouts/${id}/strength`);
    } catch {
      setStartError(actionError || "The workout could not be started. Your template is unchanged; retry when ready.");
    } finally { setStartingId(""); }
  }

  function drafts(template: StrengthTemplate): ExerciseDraft[] {
    return template.template_exercises.map((item) => ({
      name: item.exercise?.name ?? "", target_sets: String(item.target_sets), rep_min: String(item.rep_min),
      rep_max: String(item.rep_max), notes: item.notes ?? "",
    }));
  }

  return (
    <WorkoutLayout>
      <main className="strength-page">
        <header className="strength-hero">
          <div><span className="strength-kicker">Strength training</span><h1>Your routines</h1><p>Keep a clear plan for the lifts you return to. Templates organize the session; editing one never changes sessions already started.</p></div>
          {editing === undefined && <button type="button" className="strength-button strength-button--primary" onClick={() => setEditing(null)}><Plus size={16} /> New template</button>}
        </header>
        {editing !== undefined ? (
          <TemplateForm key={editing?.id ?? "new"} templateId={editing?.id ?? null} initialName={editing?.name} initialEntries={editing ? drafts(editing) : undefined}
            onCancel={() => { setEditing(undefined); clearError(); }} onSaved={() => { setEditing(undefined); reload(); }} />
        ) : (
          <>
            {(error || startError || actionError) && <div className="strength-banner" role="alert"><p>{error || startError || actionError}</p><button type="button" className="strength-button" onClick={() => { setStartError(""); clearError(); reload(); }}>Retry loading templates</button></div>}
            <section className="strength-panel">
              <div className="strength-panel-head"><h2>Template library</h2><span className="strength-meta">{templates.length} {templates.length === 1 ? "routine" : "routines"}</span></div>
              <label className="strength-field strength-date-field" style={{ marginBottom: 16 }}>Workout date
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              {loading ? <div className="strength-loading" aria-label="Loading templates"><span className="strength-skeleton" /><span className="strength-skeleton" /></div> :
                templates.length ? <div className="strength-template-list">{templates.map((template) => (
                  <article className="strength-template-card" key={template.id}>
                    <h3>{template.name}</h3>
                    <p>{template.template_exercises.map((item) => item.exercise?.name).filter(Boolean).join(" · ")}</p>
                    <div className="strength-template-actions">
                      <button type="button" className="strength-button strength-button--primary" disabled={pending} onClick={() => start(template)}><Play size={14} /> {startingId === template.id ? "Starting…" : `Start ${template.name}`}</button>
                      <button type="button" className="strength-button" onClick={() => { clearError(); setEditing(template); }}><Pencil size={14} /> Edit {template.name}</button>
                    </div>
                  </article>
                ))}</div> : <div className="strength-empty"><strong>No routines yet</strong>Create a template once, then use it to start a strength session.</div>}
            </section>
            <p className="strength-meta"><Dumbbell size={14} aria-hidden="true" /> <Link className="strength-meta" to="/app/workouts">Workout history</Link></p>
          </>
        )}
      </main>
    </WorkoutLayout>
  );
}

export default TemplateLibrary;
