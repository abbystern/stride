export const WORKOUT_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
] as const;

export const RUN_TYPES = [
  "Easy/Base",
  "Recovery",
  "Long Run",
  "Tempo/Threshold",
  "VO2 Max",
  "Sprints/Strides",
] as const;

export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number]["value"];
export type WorkoutType = { id: string; name: string };
export type Workout = {
  id: string;
  user_id: string;
  workout_type_id: string;
  date: string;
  title: string;
  status: WorkoutStatus;
  run_type: string | null;
  distance_miles: number | null;
  duration_minutes: number | null;
  target_pace: string | null;
  elevation_feet: number | null;
  notes: string | null;
  created_at: string;
  workout_type: WorkoutType | null;
};

export type WorkoutFormValues = {
  title: string;
  date: string;
  workout_type_id: string;
  status: string;
  run_type: string;
  distance_miles: string;
  duration_minutes: string;
  target_pace: string;
  elevation_feet: string;
  notes: string;
};

export type WorkoutFieldErrors = Partial<Record<keyof WorkoutFormValues, string>>;
export type WorkoutPayload = Omit<
  Workout,
  "id" | "user_id" | "created_at" | "workout_type"
>;

export function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function emptyWorkoutValues(): WorkoutFormValues {
  return {
    title: "",
    date: localDateString(),
    workout_type_id: "",
    status: "planned",
    run_type: "",
    distance_miles: "",
    duration_minutes: "",
    target_pace: "",
    elevation_feet: "",
    notes: "",
  };
}

export function workoutToFormValues(workout: Workout): WorkoutFormValues {
  return {
    title: workout.title,
    date: workout.date,
    workout_type_id: workout.workout_type_id,
    status: workout.status,
    run_type: workout.run_type ?? "",
    distance_miles: workout.distance_miles?.toString() ?? "",
    duration_minutes: workout.duration_minutes?.toString() ?? "",
    target_pace: workout.target_pace ?? "",
    elevation_feet: workout.elevation_feet?.toString() ?? "",
    notes: workout.notes ?? "",
  };
}

export function validateWorkout(
  values: WorkoutFormValues,
  types: WorkoutType[],
): { errors: WorkoutFieldErrors; payload: WorkoutPayload | null } {
  const errors: WorkoutFieldErrors = {};
  if (!values.title.trim()) errors.title = "Give your workout a title.";

  const date = new Date(`${values.date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(values.date) ||
    values.date.startsWith("0000") ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== values.date
  ) {
    errors.date = "Choose a valid workout date.";
  }

  const activity = types.find((type) => type.id === values.workout_type_id);
  if (!activity) errors.workout_type_id = "Choose an activity type.";
  if (!WORKOUT_STATUSES.some((status) => status.value === values.status)) {
    errors.status = "Choose Planned, In Progress, or Completed.";
  }

  function measurement(
    field: "distance_miles" | "duration_minutes" | "elevation_feet",
    label: string,
  ) {
    const text = values[field].trim();
    if (!text) return null;
    const number = Number(text);
    if (!Number.isFinite(number) || number < 0) {
      errors[field] = `${label} must be zero or a positive number.`;
      return null;
    }
    return number;
  }

  const distance = measurement("distance_miles", "Distance");
  const duration = measurement("duration_minutes", "Duration");
  const elevation = measurement("elevation_feet", "Elevation gain");
  if (Object.keys(errors).length) return { errors, payload: null };

  const running = activity?.name === "Running";
  return {
    errors,
    payload: {
      title: values.title.trim(),
      date: values.date,
      workout_type_id: values.workout_type_id,
      status: values.status as WorkoutStatus,
      distance_miles: distance,
      duration_minutes: duration,
      elevation_feet: elevation,
      notes: values.notes.trim() || null,
      run_type: running ? values.run_type.trim() || null : null,
      target_pace: running ? values.target_pace.trim() || null : null,
    },
  };
}

export function formatWorkoutDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
