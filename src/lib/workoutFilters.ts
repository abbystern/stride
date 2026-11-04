import type { Workout } from "./workoutModel";

export const WORKOUT_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "distance", label: "Longest distance first" },
] as const;

export type WorkoutSort = (typeof WORKOUT_SORT_OPTIONS)[number]["value"];
export type WorkoutFilters = {
  search: string;
  activityId: string;
  status: string;
  sort: WorkoutSort;
};

export const DEFAULT_WORKOUT_FILTERS: WorkoutFilters = {
  search: "", activityId: "", status: "", sort: "newest",
};

export function hasWorkoutFilters(filters: WorkoutFilters) {
  return Boolean(filters.search.trim() || filters.activityId || filters.status);
}

/** Filter only already-authorized records; never mutates the shared query data. */
export function filterAndSortWorkouts(workouts: Workout[], filters: WorkoutFilters) {
  const search = filters.search.trim().toLowerCase();
  const result = workouts.filter((workout) =>
    (!search || workout.title.toLowerCase().includes(search)) &&
    (!filters.activityId || workout.workout_type_id === filters.activityId) &&
    (!filters.status || workout.status === filters.status),
  );

  return result.sort((a, b) => {
    if (filters.sort === "distance") {
      if (a.distance_miles === null && b.distance_miles !== null) return 1;
      if (b.distance_miles === null && a.distance_miles !== null) return -1;
      if (a.distance_miles !== null && b.distance_miles !== null) {
        const distance = b.distance_miles - a.distance_miles;
        if (distance) return distance;
      }
    }
    const direction = filters.sort === "oldest" ? 1 : -1;
    const date = a.date.localeCompare(b.date);
    if (date) return date * direction;
    const created = a.created_at.localeCompare(b.created_at);
    return created ? created * direction : a.id.localeCompare(b.id);
  });
}
