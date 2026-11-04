import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import { useWorkouts } from "../../hooks/useWorkouts";
import { useStars } from "../../providers/StarsProvider";
import { WorkoutLayout } from "../../components/workouts/WorkoutLayout";
import { WorkoutList } from "../../components/workouts/WorkoutList";

export default function StarredWorkoutsPage() {
  const { workouts, loading: workoutsLoading, error: workoutsError, reload: reloadWorkouts } = useWorkouts();
  const { starredIds, loading: starsLoading, error: starsError, reload: reloadStars } = useStars();
  const loading = workoutsLoading || starsLoading;
  const starredWorkouts = workouts.filter((workout) => starredIds.has(workout.id));

  return (
    <WorkoutLayout hideStarsError>
      <main className="workout-main workout-main--wide">
        <div className="workout-heading">
          <div>
            <span className="eyebrow">KEPT CLOSE</span>
            <h1>Starred Workouts</h1>
            <p>The sessions you want to find again.</p>
          </div>
        </div>
        {loading ? (
          <section aria-label="Loading starred workouts">
            {[0, 1, 2].map((item) => <div className="workout-skeleton" key={item}><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" /></div>)}
          </section>
        ) : starsError ? (
          <section className="workout-state" role="alert">
            <div className="starred-empty-mark"><Star size={19} aria-hidden="true" /></div>
            <h2>Your starred workouts couldn’t load</h2>
            <p>{starsError}</p>
            <button type="button" className="workout-secondary" onClick={reloadStars}>Try again</button>
          </section>
        ) : workoutsError ? (
          <section className="workout-state" role="alert">
            <h2>Your workouts couldn’t load</h2>
            <p>{workoutsError}</p>
            <button type="button" className="workout-secondary" onClick={reloadWorkouts}>Try again</button>
          </section>
        ) : starredWorkouts.length === 0 ? (
          <section className="workout-state starred-empty">
            <div className="starred-empty-mark"><Star size={19} aria-hidden="true" /></div>
            <h2>A place for the ones worth repeating</h2>
            <p>Tap the star beside any workout in your history, and it’ll be waiting here.</p>
            <Link to="/app/workouts" className="workout-secondary">Browse workout history <ArrowRight size={15} aria-hidden="true" /></Link>
          </section>
        ) : (
          <>
            <WorkoutList workouts={starredWorkouts} />
            <p className="workout-row-meta workout-count">
              {starredWorkouts.length} {starredWorkouts.length === 1 ? "workout" : "workouts"}
            </p>
          </>
        )}
      </main>
    </WorkoutLayout>
  );
}
