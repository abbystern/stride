import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { emptyExercise, validateTemplate } from "../../lib/strengthModel";
import type { ExerciseDraft } from "../../lib/strengthModel";
import { useStrengthActions } from "../../hooks/useStrength";

type Props = {
  templateId: string | null;
  initialName?: string;
  initialEntries?: ExerciseDraft[];
  onCancel: () => void;
  onSaved: (id: string) => void;
};

export function TemplateForm({ templateId, initialName = "", initialEntries, onCancel, onSaved }: Props) {
  const { pending, error: actionError, clearError, saveTemplate } = useStrengthActions();
  const [name, setName] = useState(initialName);
  const [entries, setEntries] = useState<ExerciseDraft[]>(() => initialEntries?.length ? initialEntries.map((entry) => ({ ...entry })) : [emptyExercise()]);
  const [error, setError] = useState("");

  function patchEntry(index: number, field: keyof ExerciseDraft, value: string) {
    setEntries((current) => current.map((item, at) => at === index ? { ...item, [field]: value } : item));
  }
  function move(index: number, direction: -1 | 1) {
    setEntries((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    const validation = validateTemplate(name, entries);
    if (validation) { setError(validation); return; }
    setError("");
    try {
      const id = await saveTemplate(templateId, name, entries);
      onSaved(id);
    } catch {
      // Keep all entered values in place so the user can correct or retry.
    }
  }

  return (
    <section className="strength-panel" aria-labelledby="strength-template-form-title">
      <div className="strength-panel-head">
        <h2 id="strength-template-form-title">{templateId ? "Edit template" : "New template"}</h2>
      </div>
      {(error || actionError) && <div className="strength-banner" role="alert"><p>{error || actionError}</p></div>}
      <form className="strength-form" onSubmit={submit}>
        <label className="strength-field">Template name
          <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} required />
        </label>
        <div>
          <div className="strength-panel-head">
            <h2>Exercises</h2>
            <span className="strength-meta">{entries.length} / 30</span>
          </div>
          {entries.map((entry, index) => (
            <fieldset className="strength-exercise" key={index} style={{ margin: "0 0 11px" }}>
              <legend className="strength-kicker">Exercise {index + 1}</legend>
              <div className="strength-exercise-top">
                <strong>Order and details</strong>
                <div className="strength-order">
                  <button type="button" className="strength-icon-button" aria-label={`Move exercise ${index + 1} up`} onClick={() => move(index, -1)} disabled={index === 0} title="Move up"><ArrowUp size={15} /></button>
                  <button type="button" className="strength-icon-button" aria-label={`Move exercise ${index + 1} down`} onClick={() => move(index, 1)} disabled={index === entries.length - 1} title="Move down"><ArrowDown size={15} /></button>
                  <button type="button" className="strength-icon-button" aria-label={`Remove exercise ${index + 1}`} onClick={() => setEntries((current) => current.filter((_, at) => at !== index))} disabled={entries.length <= 1} title="Remove"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="strength-exercise-grid">
                <label className="strength-field">Exercise name<input value={entry.name} maxLength={120} onChange={(event) => patchEntry(index, "name", event.target.value)} required /></label>
                <label className="strength-field">Sets<input type="number" min="1" max="20" step="1" value={entry.target_sets} onChange={(event) => patchEntry(index, "target_sets", event.target.value)} required /></label>
                <label className="strength-field">Rep min<input type="number" min="1" max="1000" step="1" value={entry.rep_min} onChange={(event) => patchEntry(index, "rep_min", event.target.value)} required /></label>
                <label className="strength-field">Rep max<input type="number" min="1" max="1000" step="1" value={entry.rep_max} onChange={(event) => patchEntry(index, "rep_max", event.target.value)} required /></label>
                <label className="strength-field strength-field--notes">Notes (optional)<textarea maxLength={2000} value={entry.notes} onChange={(event) => patchEntry(index, "notes", event.target.value)} /></label>
              </div>
            </fieldset>
          ))}
          <button type="button" className="strength-button" onClick={() => setEntries((current) => current.length < 30 ? [...current, emptyExercise()] : current)} disabled={entries.length >= 30}><Plus size={15} /> Add exercise</button>
        </div>
        <div className="strength-form-actions">
          <button type="button" className="strength-button" onClick={onCancel} disabled={pending}>Cancel</button>
          <button type="submit" className="strength-button strength-button--primary" disabled={pending}>{pending ? "Saving…" : "Save template"}</button>
        </div>
      </form>
    </section>
  );
}
