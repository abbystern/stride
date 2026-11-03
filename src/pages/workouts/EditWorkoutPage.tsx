import { Link, useParams } from "react-router-dom";
import { useWorkout } from "../../hooks/useWorkouts";
import { WorkoutForm } from "../../components/workouts/WorkoutForm";
import { WorkoutLayout } from "../../components/workouts/WorkoutLayout";

export default function EditWorkoutPage() {
  const { id = "" } = useParams();
  const { workout, loading, error, reload } = useWorkout(id);
  if (loading) {
    return <WorkoutLayout><main className="workout-main"><section className="workout-panel" aria-label="Loading workout"><div className="workout-skeleton"><span className="skeleton-line" /><span className="skeleton-line" /></div></section></main></WorkoutLayout>;
  }
  if (error || !workout) {
    return (
      <WorkoutLayout>
        <main className="workout-main">
          <section className="workout-state" role={error ? "alert" : undefined}>
            <h2>{error ? "Workout couldn’t load" : "Workout not found"}</h2>
            <p>{error || "This workout may have been removed or may not be available to your account."}</p>
            {error ? <button type="button" className="workout-secondary" onClick={reload}>Try again</button> : <Link to="/app/workouts" className="workout-secondary">Return to history</Link>}
          </section>
        </main>
      </WorkoutLayout>
    );
  }
  return <WorkoutForm mode="edit" workout={workout} />;
}
