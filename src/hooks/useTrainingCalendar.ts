import { useMemo } from "react";
import { calculateCalendarWeek } from "../lib/calendarModel";
import { useWorkouts, useWorkoutMutations } from "./useWorkouts";
import { useWeeklyGoal } from "./useWeeklyGoal";

export function useTrainingCalendar(weekStart: string) {
  const { workouts, loading, error, reload } = useWorkouts();
  const mutations = useWorkoutMutations();
  const goal = useWeeklyGoal(weekStart);
  const summary = useMemo(() => calculateCalendarWeek(workouts, weekStart), [workouts, weekStart]);

  async function moveWorkout(id: string, date: string) {
    await mutations.rescheduleWorkout(id, date);
    reload();
  }

  return {
    workouts,
    ...summary,
    workoutsLoading: loading,
    workoutsError: error,
    reloadWorkouts: reload,
    moveWorkout,
    movePending: mutations.pending,
    moveError: mutations.error,
    clearMoveError: mutations.clearError,
    goal: goal.goal,
    goalLoading: goal.loading,
    goalError: goal.error,
    goalPending: goal.pending,
    reloadGoal: goal.reload,
    saveGoal: goal.save,
  };
}
