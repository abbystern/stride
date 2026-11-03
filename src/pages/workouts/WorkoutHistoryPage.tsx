import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { useWorkouts } from "../../hooks/useWorkouts";
import { formatWorkoutDate, WORKOUT_STATUSES } from "../../lib/workoutModel";
import { WorkoutLayout } from "../../components/workouts/WorkoutLayout";

export default function WorkoutHistoryPage() {
  const { workouts, loading, error, reload } = useWorkouts();
  return (
    <WorkoutLayout>
      <main className="workout-main workout-main--wide">
        <div className="workout-heading">
          <div>
            <span className="eyebrow">YOUR TRAINING JOURNAL</span>
            <h1>Workout history</h1>
            <p>A record of the movement you’ve made time for.</p>
          </div>
          <Link to="/app/workouts/new" className="workout-action"><Plus size={16} aria-hidden="true" /> Log a workout</Link>
        </div>
        {loading ? (
          <section aria-label="Loading workout history">
            {[0, 1, 2].map((item) => <div className="workout-skeleton" key={item}><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" /></div>)}
          </section>
        ) : error ? (
          <section className="workout-state" role="alert">
            <h2>Your history couldn’t load</h2>
            <p>{error}</p>
            <button type="button" className="workout-secondary" onClick={reload}>Try again</button>
          </section>
        ) : workouts.length === 0 ? (
          <section className="workout-state">
            <h2>Your journal starts here</h2>
            <p>Log a run, a strength session, or another activity to keep a note of how it went.</p>
            <Link to="/app/workouts/new" className="workout-action"><Plus size={16} aria-hidden="true" /> Log your first workout</Link>
          </section>
        ) : (
          <div className="workout-list">
            {workouts.map((workout) => {
              const status = WORKOUT_STATUSES.find((item) => item.value === workout.status);
              return (
                <article className="workout-row" key={workout.id}>
                  <Link to={`/app/workouts/${workout.id}`} className="workout-row-link" aria-label={`Open ${workout.title}, ${formatWorkoutDate(workout.date)}`}>
                    <h2 className="workout-row-title">{workout.title}</h2>
                    <div className="workout-row-meta">
                      <span>{formatWorkoutDate(workout.date)}</span>
                      <span>{workout.workout_type?.name ?? "Activity"}</span>
                    </div>
                    {(workout.distance_miles !== null || workout.duration_minutes !== null) && (
                      <div className="workout-row-measures">
                        {workout.distance_miles !== null && <span>{workout.distance_miles} mi</span>}
                        {workout.duration_minutes !== null && <span>{workout.duration_minutes} min</span>}
                      </div>
                    )}
                  </Link>
                  <span className="status-pill" data-status={workout.status}>{status?.label ?? workout.status}</span>
                </article>
              );
            })}
          </div>
        )}
        {!loading && !error && workouts.length > 0 && (
          <p className="workout-row-meta" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            {workouts.length} {workouts.length === 1 ? "workout" : "workouts"} <ArrowRight size={14} aria-hidden="true" />
          </p>
        )}
      </main>
    </WorkoutLayout>
  );
}
