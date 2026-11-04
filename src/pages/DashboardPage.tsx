import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { WorkoutLayout } from "../components/workouts/WorkoutLayout";
import { useDashboard } from "../hooks/useDashboard";
import { formatRunningPace, formatWeekDate } from "../lib/dashboard";
import "../dashboard.css";

function formatRange(start: string, end: string) {
  return `${formatWeekDate(start)}, ${start.slice(0, 4)} – ${formatWeekDate(end)}, ${end.slice(0, 4)}`;
}

function formatMileage(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} mi`
    : "—";
}

function MileageTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { weekStart?: string; weekEnd?: string; miles?: number } }>;
}) {
  const week = payload?.[0]?.payload;
  if (!active || !week || typeof week.miles !== "number" || !Number.isFinite(week.miles)) return null;
  return (
    <div className="dashboard-tooltip">
      <span className="dashboard-tooltip-date">
        {week.weekStart && week.weekEnd ? formatRange(week.weekStart, week.weekEnd) : "Weekly total"}
      </span>
      <span className="dashboard-tooltip-value">{formatMileage(week.miles)}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { workouts, summary, loading, error, refresh } = useDashboard();
  const weeks = summary.weeks;
  const hasWorkouts = workouts.length > 0;
  const hasCompletedRunningDistance = weeks.some((week) => week.miles > 0);
  const showNoRunsNote = !loading && !error && hasWorkouts && !hasCompletedRunningDistance;

  return (
    <WorkoutLayout>
      <main className="dashboard-main">
        <header className="dashboard-heading">
          <div>
            <span className="eyebrow">YOUR TRAINING JOURNAL</span>
            <h1>Training dashboard</h1>
            <p>A clear look at your completed training, week by week.</p>
          </div>
          <button className="dashboard-retry" type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" />
            {loading ? "Updating…" : "Refresh"}
          </button>
        </header>

        {error && (
          <div className="dashboard-note dashboard-note--alert" role="alert">
            <p>{error}</p>
            <button className="dashboard-retry" type="button" onClick={refresh} disabled={loading}>
              Try again
            </button>
          </div>
        )}

        <div className="dashboard-period-grid">
          <section className="dashboard-period" aria-labelledby="this-week-heading">
            <header className="dashboard-period-heading">
              <div>
                <span className="dashboard-period-kicker">MONDAY — SUNDAY</span>
                <h2 id="this-week-heading">This week</h2>
                <p>{formatRange(summary.weekStart, summary.weekEnd)}</p>
              </div>
            </header>
            <div className="dashboard-metrics" aria-label="This week's training summary">
              <article className="dashboard-metric">
                <span className="dashboard-metric-label">Running mileage</span>
                {loading || error ? <span className="dashboard-skeleton" aria-label={loading ? "Loading weekly mileage" : "Weekly mileage unavailable"} /> : (
                  <strong className="dashboard-metric-value" data-testid="weekly-mileage">{summary.weeklyMileage.toFixed(1)}</strong>
                )}
                <span className="dashboard-metric-unit">miles · completed runs</span>
              </article>
              <article className="dashboard-metric">
                <span className="dashboard-metric-label">Completed workouts</span>
                {loading || error ? <span className="dashboard-skeleton" aria-label={loading ? "Loading weekly completed workouts" : "Weekly completed workouts unavailable"} /> : (
                  <strong className="dashboard-metric-value" data-testid="completed-workouts">{summary.completedWorkouts}</strong>
                )}
                <span className="dashboard-metric-unit">workouts · all types</span>
              </article>
              <article className="dashboard-metric">
                <span className="dashboard-metric-label">Average running pace</span>
                {loading || error ? <span className="dashboard-skeleton" aria-label={loading ? "Loading weekly average pace" : "Weekly average pace unavailable"} /> : (
                  <strong className="dashboard-metric-value" data-testid="average-pace">
                    {formatRunningPace(summary.averagePace)}{summary.averagePace !== null && <small className="dashboard-pace-unit">/mi</small>}
                  </strong>
                )}
                <span className="dashboard-metric-unit">
                  {loading || error ? "min / mile · completed runs" :
                    `${summary.paceWorkoutCount} eligible completed ${summary.paceWorkoutCount === 1 ? "run" : "runs"}`}
                </span>
              </article>
            </div>
            {!loading && !error && (
              <p className="dashboard-note dashboard-period-note">
                Metrics cover Monday through Sunday in your local calendar.
                {summary.averagePace === null && " Pace appears when at least one completed run has both a positive distance and duration."}
                {summary.averagePace !== null && (
                  <span data-testid="pace-calculation">
                    {" "}Pace: {summary.paceDurationMinutes.toLocaleString("en-US", { maximumFractionDigits: 3 })} minutes ÷ {summary.paceDistanceMiles.toLocaleString("en-US", { maximumFractionDigits: 3 })} miles, using only eligible completed Running workouts this week.
                  </span>
                )}
              </p>
            )}
          </section>

          <section className="dashboard-period dashboard-period--overall" aria-labelledby="overall-heading">
            <header className="dashboard-period-heading">
              <div>
                <span className="dashboard-period-kicker">ALL DATES</span>
                <h2 id="overall-heading">Overall</h2>
                <p>Your complete training journal</p>
              </div>
            </header>
            <div className="dashboard-metrics" aria-label="Overall training summary">
              <article className="dashboard-metric">
                <span className="dashboard-metric-label">Running mileage</span>
                {loading || error ? <span className="dashboard-skeleton" aria-label={loading ? "Loading overall mileage" : "Overall mileage unavailable"} /> : (
                  <strong className="dashboard-metric-value" data-testid="overall-mileage">{summary.overall.runningMileage.toFixed(1)}</strong>
                )}
                <span className="dashboard-metric-unit">miles · completed runs</span>
              </article>
              <article className="dashboard-metric">
                <span className="dashboard-metric-label">Completed workouts</span>
                {loading || error ? <span className="dashboard-skeleton" aria-label={loading ? "Loading overall completed workouts" : "Overall completed workouts unavailable"} /> : (
                  <strong className="dashboard-metric-value" data-testid="overall-completed-workouts">{summary.overall.completedWorkouts}</strong>
                )}
                <span className="dashboard-metric-unit">workouts · all types</span>
              </article>
              <article className="dashboard-metric">
                <span className="dashboard-metric-label">Average running pace</span>
                {loading || error ? <span className="dashboard-skeleton" aria-label={loading ? "Loading overall average pace" : "Overall average pace unavailable"} /> : (
                  <strong className="dashboard-metric-value" data-testid="overall-average-pace">
                    {formatRunningPace(summary.overall.averagePace)}{summary.overall.averagePace !== null && <small className="dashboard-pace-unit">/mi</small>}
                  </strong>
                )}
                <span className="dashboard-metric-unit">
                  {loading || error ? "min / mile · completed runs" :
                    `${summary.overall.paceWorkoutCount} eligible completed ${summary.overall.paceWorkoutCount === 1 ? "run" : "runs"}`}
                </span>
              </article>
            </div>
            {!loading && !error && (
              <p className="dashboard-note dashboard-period-note">
                Totals include completed workouts across all dates.
                {summary.overall.averagePace === null && " Pace appears when at least one completed run has both a positive distance and duration."}
                {summary.overall.averagePace !== null && (
                  <span data-testid="overall-pace-calculation">
                    {" "}Pace: {summary.overall.paceDurationMinutes.toLocaleString("en-US", { maximumFractionDigits: 3 })} minutes ÷ {summary.overall.paceDistanceMiles.toLocaleString("en-US", { maximumFractionDigits: 3 })} miles, using only eligible completed Running workouts.
                  </span>
                )}
              </p>
            )}
          </section>
        </div>

        <section className="dashboard-panel" aria-labelledby="weekly-mileage-heading">
          <div className="dashboard-panel-heading">
            <div>
              <h2 id="weekly-mileage-heading">Running mileage</h2>
              <p>Completed running distance across the last six calendar weeks.</p>
            </div>
          </div>

          {loading ? (
            <div className="dashboard-loading-chart" aria-label="Loading six weeks of running mileage" />
          ) : error ? (
            <div className="workout-state" role="status">
              <h2>Training data isn’t available yet</h2>
              <p>We couldn’t load your weekly mileage. Try again to refresh your journal.</p>
            </div>
          ) : (
            <>
              <div className="dashboard-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    className="dashboard-chart"
                    data={weeks}
                    margin={{ top: 28, right: 8, bottom: 2, left: -12 }}
                    accessibilityLayer
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="weekStart"
                      tickLine={false}
                      axisLine={{ stroke: "#e7e5df" }}
                      interval={0}
                      tick={({ x, y, payload }) => {
                        const week = weeks.find((item) => item.weekStart === payload.value);
                        if (!week) return <g />;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text textAnchor="middle" fill="#626872" fontSize="10">
                              <tspan x="0" dy="12">{formatWeekDate(week.weekStart)}</tspan>
                              <tspan x="0" dy="12">– {formatWeekDate(week.weekEnd)}</tspan>
                            </text>
                          </g>
                        );
                      }}
                      height={42}
                    />
                    <YAxis
                      dataKey="miles"
                      type="number"
                      domain={[0, (dataMax: number) => dataMax === 0 ? 1 : dataMax]}
                      tickLine={false}
                      axisLine={false}
                      tickCount={4}
                      width={42}
                      tickFormatter={formatMileage}
                    />
                    <Tooltip content={<MileageTooltip />} cursor={{ fill: "#e9edff" }} isAnimationActive={false} />
                    <Bar dataKey="miles" name="Miles" fill="#345cff" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                      <LabelList dataKey="miles" position="top" formatter={formatMileage} fontSize={10} fill="#2447dc" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="dashboard-note">Miles are completed running distance; each bar runs Monday–Sunday. Weeks without completed running mileage remain at zero.</p>
              {showNoRunsNote && (
                <div className="dashboard-empty">
                  <p>No completed running mileage in this six-week view.</p>
                  <p>Your journal has workouts, but they may be planned, in progress, non-running, or missing a distance. <Link to="/app/workouts">View workout history</Link>.</p>
                </div>
              )}
              {!hasWorkouts && (
                <div className="dashboard-empty">
                  <p>No workouts yet.</p>
                  <p>Log a completed run to start seeing your weekly distance. <Link to="/app/workouts/new">Log your first workout</Link>.</p>
                </div>
              )}
              <details className="dashboard-table-details">
                <summary>View weekly mileage as a table</summary>
                <div className="dashboard-table-scroll">
                  <table className="dashboard-table" aria-label="Weekly completed running mileage">
                    <thead>
                      <tr><th scope="col">Calendar week (Monday–Sunday)</th><th scope="col">Miles</th></tr>
                    </thead>
                    <tbody>
                      {weeks.map((week) => (
                        <tr key={week.weekStart}>
                          <td>{formatRange(week.weekStart, week.weekEnd)}</td>
                          <td>{week.miles.toFixed(1)} mi</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </section>
      </main>
    </WorkoutLayout>
  );
}
