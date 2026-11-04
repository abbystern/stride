import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useWorkout, useWorkoutMutations } from "../../hooks/useWorkouts";
import { formatWorkoutDate, WORKOUT_STATUSES } from "../../lib/workoutModel";
import { WorkoutLayout } from "../../components/workouts/WorkoutLayout";
import { StarButton } from "../../components/workouts/StarButton";
import { useStars } from "../../providers/StarsProvider";

export default function WorkoutDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { workout, loading, error, reload } = useWorkout(id);
  const { pending, error: deleteError, clearError, deleteWorkout } = useWorkoutMutations();
  const { forgetWorkout } = useStars();
  const [confirming, setConfirming] = useState(false);

  async function confirmDelete() {
    clearError();
    try {
      await deleteWorkout(id);
      forgetWorkout(id);
      navigate("/app/workouts", { replace: true });
    } catch {
      // Keep the confirmation visible so the user can retry or cancel.
    }
  }

  return (
    <WorkoutLayout>
      <main className="workout-main">
        <p style={{ margin: "0 0 22px" }}><Link to="/app/workouts" className="workout-row-meta"><ArrowLeft size={15} aria-hidden="true" /> Workout history</Link></p>
        {loading ? (
          <section className="workout-panel" aria-label="Loading workout details">
            <div className="workout-skeleton"><span className="skeleton-line" /><span className="skeleton-line" /></div>
            <div className="workout-skeleton"><span className="skeleton-line" /><span className="skeleton-line" /></div>
          </section>
        ) : error ? (
          <section className="workout-state" role="alert">
            <h2>Workout details couldn’t load</h2>
            <p>{error}</p>
            <button type="button" className="workout-secondary" onClick={reload}>Try again</button>
          </section>
        ) : !workout ? (
          <section className="workout-state">
            <h2>Workout not found</h2>
            <p>This workout may have been removed or may not be available to your account.</p>
            <Link to="/app/workouts" className="workout-secondary">Return to history</Link>
          </section>
        ) : (
          <>
            <article className="workout-detail-card">
              <header className="workout-detail-top">
                <div>
                  <span className="eyebrow">{workout.workout_type?.name ?? "Activity"}</span>
                  <h1>{workout.title}</h1>
                  <p className="workout-detail-date">{formatWorkoutDate(workout.date)}</p>
                </div>
                <span className="status-pill" data-status={workout.status}>
                  {WORKOUT_STATUSES.find((item) => item.value === workout.status)?.label ?? workout.status}
                </span>
              </header>
              <div className="workout-detail-body">
                {workout.run_type && <DetailItem label="Run type" value={workout.run_type} />}
                {workout.target_pace && <DetailItem label="Target pace" value={workout.target_pace} />}
                {workout.distance_miles !== null && <DetailItem label="Distance" value={`${workout.distance_miles} miles`} />}
                {workout.duration_minutes !== null && <DetailItem label="Duration" value={`${workout.duration_minutes} minutes`} />}
                {workout.elevation_feet !== null && <DetailItem label="Elevation gain" value={`${workout.elevation_feet} feet`} />}
                {workout.notes && <DetailItem label="Notes" value={workout.notes} full />}
                {!workout.run_type && !workout.target_pace && workout.distance_miles === null && workout.duration_minutes === null && workout.elevation_feet === null && !workout.notes && (
                  <p className="workout-row-meta" style={{ gridColumn: "1 / -1", padding: "12px 0" }}>No additional details were saved.</p>
                )}
              </div>
              <div className="workout-detail-actions">
                <StarButton workoutId={workout.id} title={workout.title} />
                <Link to={`/app/workouts/${workout.id}/edit`} className="workout-secondary"><Pencil size={15} aria-hidden="true" /> Edit workout</Link>
                <button type="button" className="workout-danger" onClick={() => { setConfirming(true); clearError(); }} disabled={pending}>
                  <Trash2 size={15} aria-hidden="true" /> Delete
                </button>
              </div>
            </article>
            {confirming && (
              <section className="delete-confirm" aria-labelledby="delete-title">
                <div>
                  <h2 id="delete-title">Delete this workout?</h2>
                  <p>This will permanently remove “{workout.title}” from your journal.</p>
                  {deleteError && <p className="workout-field-error" role="alert" style={{ marginTop: 9 }}>{deleteError}</p>}
                </div>
                <div className="delete-confirm-actions">
                  <button type="button" className="workout-secondary" onClick={() => { setConfirming(false); clearError(); }} disabled={pending}>Cancel</button>
                  <button type="button" className="workout-danger" onClick={confirmDelete} disabled={pending}>{pending ? "Deleting…" : "Delete workout"}</button>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </WorkoutLayout>
  );
}

function DetailItem({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className="workout-detail-item" style={full ? { gridColumn: "1 / -1" } : undefined}>
      <span className="workout-detail-label">{label}</span>
      <div className="workout-detail-value">{value}</div>
    </div>
  );
}
