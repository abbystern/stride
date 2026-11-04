import { Search, X } from "lucide-react";
import { WORKOUT_SORT_OPTIONS, type WorkoutFilters as WorkoutFilterValues } from "../../lib/workoutFilters";
import { WORKOUT_STATUSES, type WorkoutType } from "../../lib/workoutModel";

type Props = {
  filters: WorkoutFilterValues;
  types: WorkoutType[];
  typesLoading: boolean;
  typesError: string;
  onChange: (filters: WorkoutFilterValues) => void;
  onClear: () => void;
  onReloadTypes: () => void;
};

export function WorkoutFilters({
  filters,
  types,
  typesLoading,
  typesError,
  onChange,
  onClear,
  onReloadTypes,
}: Props) {
  function update<K extends keyof WorkoutFilterValues>(key: K, value: WorkoutFilterValues[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section className="workout-filters" aria-labelledby="workout-filters-title">
      <div className="workout-filters__top">
        <h2 className="workout-filters__title" id="workout-filters-title">Find a workout</h2>
        <button
          className="workout-filters__clear"
          type="button"
          onClick={onClear}
          disabled={!filters.search && !filters.activityId && !filters.status && filters.sort === "newest"}
        >
          Clear filters
        </button>
      </div>
      <div className="workout-filters__grid">
        <div className="workout-filter workout-filter--search">
          <label className="workout-filter__label" htmlFor="workout-search">Search workouts</label>
          <div className="workout-filter__control workout-filter__search">
            <Search size={16} aria-hidden="true" />
            <input
              id="workout-search"
              type="search"
              value={filters.search}
              onChange={(event) => update("search", event.target.value)}
              placeholder="Search by title"
              autoComplete="off"
            />
            {filters.search && (
              <button
                type="button"
                className="workout-filter__clear-search"
                aria-label="Clear search"
                onClick={() => update("search", "")}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="workout-filter">
          <label className="workout-filter__label" htmlFor="workout-activity">Activity type</label>
          <div className="workout-filter__control">
            <select
              id="workout-activity"
              value={filters.activityId}
              disabled={typesLoading || Boolean(typesError)}
              onChange={(event) => update("activityId", event.target.value)}
              aria-describedby={typesError ? "workout-types-error" : undefined}
            >
              <option value="">
                {typesError ? "Unavailable" : typesLoading ? "Loading activities…" : "All activities"}
              </option>
              {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>
        </div>
        <div className="workout-filter">
          <label className="workout-filter__label" htmlFor="workout-status">Workout status</label>
          <div className="workout-filter__control">
            <select
              id="workout-status"
              value={filters.status}
              onChange={(event) => update("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {WORKOUT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="workout-filter">
          <label className="workout-filter__label" htmlFor="workout-sort">Sort by</label>
          <div className="workout-filter__control">
            <select
              id="workout-sort"
              value={filters.sort}
              onChange={(event) => update("sort", event.target.value as WorkoutFilterValues["sort"])}
            >
              {WORKOUT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {typesError && (
        <p className="workout-filter__notice" id="workout-types-error" role="alert">
          <span>Activity types couldn’t load. Search, status, and sorting are still available.</span>
          <button type="button" onClick={onReloadTypes}>Retry activity types</button>
        </p>
      )}
    </section>
  );
}
