import { WorkoutForm } from "../../components/workouts/WorkoutForm";
import { useSearchParams } from "react-router-dom";
import { isCalendarDate } from "../../lib/calendarModel";

export default function NewWorkoutPage() {
  const [params] = useSearchParams();
  const date = params.get("date") ?? "";
  return <WorkoutForm key={date} mode="create" initialDate={isCalendarDate(date) ? date : undefined} />;
}
