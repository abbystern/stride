import { Star } from "lucide-react";
import { useStars } from "../../providers/StarsProvider";

export function StarButton({ workoutId, title }: { workoutId: string; title: string }) {
  const { starredIds, loading, error, pendingIds, mutationErrors, toggleStar } = useStars();
  const starred = starredIds.has(workoutId);
  const pending = pendingIds.has(workoutId);
  const disabled = loading || Boolean(error) || pending;
  const errorId = `star-error-${workoutId}`;

  return (
    <div className="star-control">
      <button
        type="button"
        className={`star-button${starred ? " is-starred" : ""}`}
        aria-label={`${starred ? "Unstar" : "Star"} ${title}`}
        aria-pressed={starred}
        aria-describedby={mutationErrors[workoutId] ? errorId : undefined}
        title={starred ? "Remove from starred workouts" : "Add to starred workouts"}
        disabled={disabled}
        onClick={() => void toggleStar(workoutId)}
      >
        <Star size={18} strokeWidth={1.8} fill={starred ? "currentColor" : "none"} aria-hidden="true" />
      </button>
      {mutationErrors[workoutId] && (
        <span className="star-error" id={errorId} role="alert">{mutationErrors[workoutId]}</span>
      )}
    </div>
  );
}
