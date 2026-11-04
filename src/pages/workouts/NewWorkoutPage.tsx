import { WorkoutForm } from "../../components/workouts/WorkoutForm";
import { useSearchParams } from "react-router-dom";
import { isCalendarDate } from "../../lib/calendarModel";

export default function NewWorkoutPage() {
  const [params] = useSearchParams();
  const date = params.get("date") ?? "";
  const initialRest = params.get("activity") === "rest";
  return <WorkoutForm key={`${date}:${initialRest}`} mode="create" initialDate={isCalendarDate(date) ? date : undefined} initialRest={initialRest} />;
}
