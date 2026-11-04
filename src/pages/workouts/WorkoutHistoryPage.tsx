import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useWorkouts, useWorkoutTypes } from "../../hooks/useWorkouts";
import { WorkoutLayout } from "../../components/workouts/WorkoutLayout";
import { WorkoutList } from "../../components/workouts/WorkoutList";
import { WorkoutFilters } from "../../components/workouts/WorkoutFilters";
import {
  DEFAULT_WORKOUT_FILTERS,
  filterAndSortWorkouts,
  hasWorkoutFilters,
  type WorkoutFilters as WorkoutFilterValues,
} from "../../lib/workoutFilters";
import "../../search-filter.css";

export default function WorkoutHistoryPage() {
  const { workouts, loading, error, reload } = useWorkouts();
  const { types, loading: typesLoading, error: typesError, reload: reloadTypes } = useWorkoutTypes();
  const [filters, setFilters] = useState<WorkoutFilterValues>(DEFAULT_WORKOUT_FILTERS);
  const visibleWorkouts = useMemo(
    () => filterAndSortWorkouts(workouts, filters),
    [workouts, filters],
  );
  const filtering = hasWorkoutFilters(filters);

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
        <WorkoutFilters
          filters={filters}
          types={types}
          typesLoading={typesLoading}
          typesError={typesError}
          onChange={setFilters}
          onClear={() => setFilters(DEFAULT_WORKOUT_FILTERS)}
          onReloadTypes={reloadTypes}
        />
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
        ) : workouts.length === 0 && !filtering ? (
          <section className="workout-state">
            <h2>Your journal starts here</h2>
            <p>Log a run, a strength session, or another activity to keep a note of how it went.</p>
            <Link to="/app/workouts/new" className="workout-action"><Plus size={16} aria-hidden="true" /> Log your first workout</Link>
          </section>
        ) : visibleWorkouts.length === 0 ? (
          <section className="workout-no-results">
            <p>No workouts match your search. Try adjusting your filters.</p>
            <button type="button" className="workout-secondary" onClick={() => setFilters(DEFAULT_WORKOUT_FILTERS)}>
              Clear filters
            </button>
          </section>
        ) : (
          <>
            <p className="workout-results-count" aria-live="polite" aria-atomic="true">
              <span><strong>{visibleWorkouts.length}</strong> {visibleWorkouts.length === 1 ? "workout" : "workouts"}</span>
              <span>of {workouts.length}</span>
            </p>
            <WorkoutList workouts={visibleWorkouts} />
          </>
        )}
      </main>
    </WorkoutLayout>
  );
}
