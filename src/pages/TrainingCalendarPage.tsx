import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { WorkoutLayout } from "../components/workouts/WorkoutLayout";
import { useTrainingCalendar } from "../hooks/useTrainingCalendar";
import { calculateCalendarMonth, calendarWeekStart, isCalendarDate, localDateKey, shiftCalendarDate, shiftCalendarMonth, validateMileageGoal, compareCalendarWorkouts } from "../lib/calendarModel";
import { formatWorkoutTime, WORKOUT_STATUSES } from "../lib/workoutModel";
import { useAuth } from "../providers/AuthProvider";
import "../calendar.css";

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, options);
}

function formatWeekRange(start: string) {
  const end = shiftCalendarDate(start, 6);
  return `${formatDate(start, { month: "short", day: "numeric" })} – ${formatDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
}

export default function TrainingCalendarPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDate = searchParams.get("week");
  const view = searchParams.get("view") === "month" ? "month" : "week";
  const currentWeek = calendarWeekStart(localDateKey());
  const activeDate = requestedDate && isCalendarDate(requestedDate) ? requestedDate : currentWeek;
  const weekStart = calendarWeekStart(activeDate);
  const viewKey = `${session?.user.id ?? ""}:${weekStart}`;
  const activeView = useRef(viewKey);
  activeView.current = viewKey;
  const {
    days,
    workouts,
    scheduledMiles,
    completedMiles,
    workoutsLoading,
    workoutsError,
    reloadWorkouts,
    moveWorkout,
    movePending,
    moveError,
    clearMoveError,
    goal,
    goalLoading,
    goalError,
    goalPending,
    reloadGoal,
    saveGoal,
  } = useTrainingCalendar(weekStart);
  const visibleDays = view === "month"
    ? calculateCalendarMonth(workouts, activeDate).days.map((day) => ({ ...day, outside: !day.inMonth }))
    : days.map((day) => ({
      ...day,
      workouts: workouts.filter((workout) => workout.date === day.date).sort(compareCalendarWorkouts),
      outside: false,
    }));

  const [goalDraft, setGoalDraft] = useState("");
  const [goalMessage, setGoalMessage] = useState("");
  const [goalMessageError, setGoalMessageError] = useState(false);
  const [moveDates, setMoveDates] = useState<Record<string, string>>({});
  const [openReschedule, setOpenReschedule] = useState<string | null>(null);
  const [moveMessages, setMoveMessages] = useState<Record<string, { text: string; error: boolean }>>({});
  const [moveNotice, setMoveNotice] = useState<{ text: string; error: boolean } | null>(null);
  const goalInitializedFor = useRef<string | null>(null);
  const clearMoveErrorRef = useRef(clearMoveError);
  clearMoveErrorRef.current = clearMoveError;
  const pendingNavigation = movePending || goalPending;

  useEffect(() => {
    if (requestedDate && (!isCalendarDate(requestedDate) || (view === "week" && calendarWeekStart(requestedDate) !== requestedDate))) {
      setSearchParams({ week: view === "month" ? localDateKey() : weekStart, ...(view === "month" ? { view } : {}) }, { replace: true });
    } else if (!requestedDate) {
      setSearchParams({ week: weekStart, ...(view === "month" ? { view } : {}) }, { replace: true });
    }
  }, [requestedDate, setSearchParams, weekStart, view]);

  useEffect(() => {
    setMoveDates({});
    setMoveMessages({});
    setMoveNotice(null);
    setOpenReschedule(null);
    setGoalDraft("");
    setGoalMessage("");
    setGoalMessageError(false);
    goalInitializedFor.current = null;
    clearMoveErrorRef.current();
  }, [viewKey]);

  useEffect(() => {
    if (goalLoading || goalError || goalInitializedFor.current === viewKey) return;
    if (goal && goal.week_start !== weekStart) return;
    goalInitializedFor.current = viewKey;
    setGoalDraft(goal ? String(goal.target_miles) : "");
  }, [goal, goalLoading, goalError, weekStart, viewKey]);

  function navigateWeek(key: string) {
    if (pendingNavigation) return;
    setSearchParams({ week: key, ...(view === "month" ? { view } : {}) });
  }

  function navigatePeriod(amount: number) {
    if (pendingNavigation) return;
    navigateWeek(view === "month" ? shiftCalendarMonth(activeDate, amount) : shiftCalendarDate(weekStart, amount * 7));
  }

  function selectView(nextView: "week" | "month") {
    setSearchParams({ week: nextView === "month" ? activeDate : weekStart, ...(nextView === "month" ? { view: nextView } : {}) });
  }

  function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateMileageGoal(goalDraft);
    if (validation.error || validation.value === null) {
      setGoalMessage(validation.error);
      setGoalMessageError(true);
      return;
    }
    setGoalMessage("");
    setGoalMessageError(false);
    const requestView = viewKey;
    void saveGoal(validation.value).then(() => {
      if (activeView.current !== requestView) return;
      setGoalMessage("Weekly goal saved.");
      setGoalMessageError(false);
    }).catch((error: unknown) => {
      if (activeView.current !== requestView) return;
      setGoalMessage(error instanceof Error ? error.message : "We couldn’t save your weekly goal. Please try again.");
      setGoalMessageError(true);
    });
  }

  async function submitMove(event: FormEvent<HTMLFormElement>, workoutId: string, title: string) {
    event.preventDefault();
    const date = moveDates[workoutId] ?? "";
    if (!isCalendarDate(date)) {
      setMoveMessages((current) => ({ ...current, [workoutId]: { text: "Choose a valid date.", error: true } }));
      return;
    }
    setMoveMessages((current) => ({ ...current, [workoutId]: { text: "", error: false } }));
    setMoveNotice(null);
    clearMoveError();
    const requestView = viewKey;
    try {
      await moveWorkout(workoutId, date);
      if (activeView.current !== requestView) return;
      const success = `${title} moved to ${formatDate(date, { month: "short", day: "numeric" })}.`;
      setMoveMessages((current) => ({ ...current, [workoutId]: { text: success, error: false } }));
      setMoveNotice({ text: success, error: false });
      setOpenReschedule(null);
    } catch {
      if (activeView.current !== requestView) return;
      const failure = moveError || "We couldn’t move this workout. Your original date is unchanged; try again.";
      setMoveMessages((current) => ({ ...current, [workoutId]: { text: failure, error: true } }));
      setMoveNotice({ text: failure, error: true });
    }
  }

  const statusLabel = (value: string) =>
    WORKOUT_STATUSES.find((status) => status.value === value)?.label ?? value;

  return (
    <WorkoutLayout>
      <main className="training-calendar">
        <header className="calendar-heading">
          <div>
            <span className="calendar-kicker">YOUR TRAINING JOURNAL</span>
            <h1>Training calendar</h1>
            <p>Plan the week, keep the miles in view.</p>
          </div>
          <nav className="calendar-week-nav" aria-label="Calendar week">
            <button className="calendar-button" type="button" onClick={() => navigatePeriod(-1)} disabled={pendingNavigation} aria-label={view === "month" ? "Previous month" : "Previous week"}>{view === "month" ? "Previous month" : "Previous week"}</button>
            <button className="calendar-button" type="button" onClick={() => navigateWeek(calendarWeekStart())} disabled={pendingNavigation} aria-label="Current week">Current week</button>
            <button className="calendar-button" type="button" onClick={() => navigatePeriod(1)} disabled={pendingNavigation} aria-label={view === "month" ? "Next month" : "Next week"}>{view === "month" ? "Next month" : "Next week"}</button>
          </nav>
        </header>

        <div className="calendar-view-controls">
          <p className="calendar-period" aria-live="polite">{view === "week" ? `Monday – Sunday · ${formatWeekRange(weekStart)}` : formatDate(activeDate, { month: "long", year: "numeric" })}</p>
          <div className="calendar-view-switch" role="group" aria-label="Calendar view">
            <button type="button" aria-pressed={view === "week"} onClick={() => selectView("week")}>Week</button>
            <button type="button" aria-pressed={view === "month"} onClick={() => selectView("month")}>Month</button>
          </div>
        </div>

        <section className="calendar-overview" aria-label="Weekly training summary">
          {view === "month" && <p className="calendar-summary-scope">Goal and running totals are for the selected Monday week: {formatWeekRange(weekStart)}.</p>}
          <div className="calendar-goal-panel">
            <div className="calendar-goal-intro">
              <span>Weekly mileage goal</span>
              <strong>{goalLoading ? "Loading…" : goal ? `${goal.target_miles.toFixed(1)} mi` : "Not set"}</strong>
            </div>
            <form className="calendar-goal-form" onSubmit={submitGoal} noValidate>
              <label className="calendar-goal-field">
                Weekly mileage goal
                <input
                  className="calendar-input calendar-goal-input"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={goalDraft}
                  onChange={(event) => {
                    setGoalDraft(event.target.value);
                    setGoalMessage("");
                  }}
                  disabled={goalLoading || goalPending}
                  aria-describedby="calendar-goal-feedback"
                />
              </label>
              <button className="calendar-button calendar-button--primary" type="submit" disabled={goalLoading || goalPending}>
                {goalPending ? "Saving…" : "Save goal"}
              </button>
            </form>
          </div>

          <div className="calendar-mileage-panel" aria-label="Running mileage totals">
            <div className="calendar-mileage">
              <span className="calendar-mileage-label">Scheduled running</span>
              {workoutsLoading ? <span className="calendar-skeleton" aria-label="Loading scheduled mileage" /> : workoutsError ? <span className="calendar-mileage-value" aria-label="Scheduled mileage unavailable">—</span> : (
                <strong className="calendar-mileage-value"><span data-testid="scheduled-mileage">{scheduledMiles.toFixed(1)}</span><small className="calendar-mileage-unit">mi</small></strong>
              )}
            </div>
            <div className="calendar-mileage">
              <span className="calendar-mileage-label">Completed running</span>
              {workoutsLoading ? <span className="calendar-skeleton" aria-label="Loading completed mileage" /> : workoutsError ? <span className="calendar-mileage-value" aria-label="Completed mileage unavailable">—</span> : (
                <strong className="calendar-mileage-value"><span data-testid="completed-mileage">{completedMiles.toFixed(1)}</span><small className="calendar-mileage-unit">mi</small></strong>
              )}
            </div>
          </div>
        </section>

        <div className={`calendar-goal-status${goalMessageError || goalError ? " calendar-goal-status--error" : ""}`} id="calendar-goal-feedback" role={goalMessageError || goalError ? "alert" : "status"} aria-live="polite">
          {goalError ? (
            <span>{goalError} <button className="calendar-link" type="button" onClick={reloadGoal} disabled={goalLoading || goalPending}>Retry goal</button></span>
          ) : goalMessage || (goalPending ? "Saving weekly goal…" : "")}
        </div>

        {workoutsError && (
          <div className="calendar-banner calendar-banner--error" role="alert">
            <div className="calendar-banner-row">
              <p>{workoutsError} Your goal and week navigation are still available.</p>
              <button className="calendar-button" type="button" onClick={reloadWorkouts} disabled={workoutsLoading}>Retry</button>
            </div>
          </div>
        )}

        {(moveError || moveNotice) && (
          <div className={`calendar-banner ${moveNotice?.error || moveError ? "calendar-banner--error" : "calendar-banner--success"}`} role={moveNotice?.error || moveError ? "alert" : "status"} aria-live="polite">
            <p>{moveNotice?.text || `${moveError} The workout remains on its original date.`}</p>
          </div>
        )}

        <section className={`calendar-week-grid${view === "month" ? " calendar-week-grid--month" : ""}`} aria-label={view === "week" ? `Workouts for the week of ${formatDate(weekStart, { month: "long", day: "numeric" })}` : `Workouts for ${formatDate(activeDate, { month: "long", year: "numeric" })}`}>
          {visibleDays.map((day) => {
            const today = day.date === localDateKey();
            return (
              <section className={`calendar-day${today ? " calendar-day--today" : ""}${day.outside ? " calendar-day--outside" : ""}`} aria-label={day.label} data-date={day.date} key={day.date}>
                <header className="calendar-day-header">
                  <span>{formatDate(day.date, { weekday: "long" })}{today ? " · Today" : ""}</span>
                  <strong>
                    <button
                      className="calendar-day-date-select"
                      type="button"
                      onClick={() => navigateWeek(day.date)}
                      aria-label={`Select ${day.label} for weekly summary`}
                      aria-pressed={view === "month" && day.date === activeDate}
                    >
                      {formatDate(day.date, { month: "short", day: "numeric" })}
                    </button>
                  </strong>
                </header>
                <div className="calendar-day-content">
                  {workoutsLoading ? (
                    <p className="calendar-empty-day" role="status">Loading workouts…</p>
                  ) : workoutsError ? (
                    <p className="calendar-empty-day">Workout details unavailable.</p>
                  ) : day.workouts.length === 0 ? (
                    <p className="calendar-empty-day">No workouts planned for this day.</p>
                  ) : day.workouts.map((workout) => {
                    const feedback = moveMessages[workout.id];
                    const isOpen = openReschedule === workout.id;
                    return (
                      <article className={`calendar-workout calendar-workout--${workout.status}${workout.workout_type?.name === "Rest Day" ? " calendar-workout--rest" : ""}`} data-workout-id={workout.id} key={workout.id}>
                        <span className="calendar-workout-type">{workout.workout_type?.name === "Rest Day" ? "Rest Day" : workout.workout_type?.name ?? "Workout"}</span>
                        <Link className="calendar-workout-title" to={`/app/workouts/${workout.id}`}>{workout.title}</Link>
                        <span className="calendar-workout-time">{formatWorkoutTime(workout.scheduled_start_time)}</span>
                        <span className={`calendar-status calendar-status--${workout.status}`}>{statusLabel(workout.status)}</span>
                        <div className="calendar-reschedule">
                          <button
                            type="button"
                            className="calendar-reschedule-toggle"
                            onClick={() => {
                              setMoveDates((current) => ({ ...current, [workout.id]: current[workout.id] ?? workout.date }));
                              setMoveMessages((current) => ({ ...current, [workout.id]: { text: "", error: false } }));
                              setOpenReschedule(isOpen ? null : workout.id);
                            }}
                            disabled={movePending}
                            aria-expanded={isOpen}
                          >
                            Reschedule {workout.title}
                          </button>
                          {isOpen && (
                            <form className="calendar-reschedule-form" onSubmit={(event) => void submitMove(event, workout.id, workout.title)}>
                              <label className="calendar-reschedule-field">
                                New date for {workout.title}
                                <input
                                  className="calendar-input"
                                  type="date"
                                  value={moveDates[workout.id] ?? workout.date}
                                  onChange={(event) => {
                                    setMoveDates((current) => ({ ...current, [workout.id]: event.target.value }));
                                    setMoveMessages((current) => ({ ...current, [workout.id]: { text: "", error: false } }));
                                  }}
                                  disabled={movePending}
                                />
                              </label>
                              <button className="calendar-button calendar-date-submit" type="submit" disabled={movePending}>
                                {movePending ? "Saving date…" : "Save date"}
                              </button>
                            </form>
                          )}
                          {feedback?.text && <p className={`calendar-move-feedback${feedback.error ? " calendar-move-feedback--error" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
                        </div>
                      </article>
                    );
                  })}
                  <div className="calendar-day-actions">
                    <Link className="calendar-link" to={`/app/workouts/new?date=${day.date}`} aria-label={`Add workout on ${day.date}`}>+ Add workout</Link>
                    <Link className="calendar-link" to={`/app/workouts/new?date=${day.date}&activity=rest`} aria-label={`Add rest day on ${day.date}`}>+ Add rest day</Link>
                  </div>
                </div>
              </section>
            );
          })}
        </section>
      </main>
    </WorkoutLayout>
  );
}
