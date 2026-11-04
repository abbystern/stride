import { Link } from "react-router-dom";
import { formatWorkoutDate, WORKOUT_STATUSES, type Workout } from "../../lib/workoutModel";
import { StarButton } from "./StarButton";

export function WorkoutList({ workouts }: { workouts: Workout[] }) {
  return (
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
            <div className="workout-row-tools">
              <span className="status-pill" data-status={workout.status}>{status?.label ?? workout.status}</span>
              <StarButton workoutId={workout.id} title={workout.title} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
