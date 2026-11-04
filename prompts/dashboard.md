# Feature 7: Training Dashboard

## Implementation prompt — verbatim

The user supplied this prompt as an attachment:

```text
I'm continuing development of Stride, my fitness training app.

Read `PLAN.md`, `schema.md`, and the existing workout logging implementation.

We are implementing Feature 7: Training Dashboard.

Current Git branch: `feature/dashboard`.

Implement only the dashboard. Do not build nutrition, strength templates, wearable integrations, or the weekly planner.

### Dashboard layout

Create a clean, responsive dashboard accessible from the main navigation.

Display three summary statistics:

1. **Weekly running mileage:** Sum the distances of completed running workouts during the current calendar week, Monday through Sunday.
2. **Completed workouts:** Count all activity types marked completed during the current week.
3. **Average running pace:** Calculate total duration divided by total distance for completed running workouts with valid distance and duration. Display as minutes:seconds per mile.

Use time-weighted aggregate pace (total duration / total distance), rather than averaging individual pace values.

### Mileage chart

Use Recharts to display a bar chart of weekly completed running mileage over the last six weeks.

Requirements:
- Each bar represents one Monday–Sunday week.
- Include appropriate labels and mileage units.
- Use only completed Running workouts.
- Exclude planned runs, hiking, walking, cycling, and other activities.
- Handle missing distances and empty weeks correctly.

### Data handling

- Query the existing Supabase workouts and workout_types tables.
- Retrieve only the authenticated user's workout records.
- Preserve the existing Row Level Security policies.
- Update the dashboard when workout records change or the page reloads.
- Show a friendly empty state if the user has no workouts.

### Design

Follow Stride's existing warm white, charcoal, and muted sage design.

Use simple metric cards and a clean bar chart. Make the dashboard mobile-friendly.

### Automated dashboard test

Implement the required dashboard calculation test using the existing test setup or a lightweight test runner such as Vitest.

Given three completed running workouts of 4, 5, and 6 miles in one week, plus one planned running workout of 8 miles, when the dashboard calculates completed weekly mileage, then the result must be 15 miles.

Separate the calculation into a pure function that can be tested without requiring a live Supabase connection.

Explain exactly how to run the test.

Do not fake a passing result. I need to capture real failing and passing test screenshots later.

### Documentation

Create `prompts/dashboard.md` including the implementation prompt, decisions, and testing instructions.

Update `schema.md` only if necessary.

### Final checks

- Run the application build.
- Run the dashboard calculation test.
- Verify the existing workout logger, favorites, and search functions still work.
- Check that no secrets or .env files are committed.
- Confirm you're on feature/dashboard.
- Commit and push the feature branch to GitHub.
- Do not merge the pull request.

Summarize what was built and explain how I can verify it.
```

## Implementation and decisions — summary

- Added `/app/dashboard` inside the existing authenticated routes. Dashboard is
  accessible from account-home actions and the shared workout navigation.
  The account home, sign-out, logger, favorites, and search routes remain intact.
- Added three summary cards and a Recharts bar chart in Stride's existing style.
  The six-week table provides an accessible alternative to the chart. Chart
  labels, tooltips, and the table identify calendar weeks and mileage units.
- Calculations live in the pure `calculateDashboard` function in
  `src/lib/dashboard.ts`. Tests inject a reference date; the app uses the
  browser's local calendar. Calendar-date workout strings are not interpreted
  as UTC timestamps. Calendar-day arithmetic avoids assuming every day is
  exactly 24 hours during daylight-saving changes.
- All three cards cover the current Monday–Sunday week. The six bars include
  that current week and the five preceding weeks, ordered oldest first.
  Completed entries later in the current calendar week are included, consistent
  with the full Monday–Sunday definition.
- Mileage includes only completed workouts whose joined activity name is
  Running. Null distances contribute nothing, actual zero stays zero, and
  nonfinite/negative measurements are excluded defensively.
- Completed workouts counts all completed activity types within the current
  week, even when optional measurements are missing.
- Pace uses **total duration / total distance** for completed Running workouts
  with both measurements finite and strictly positive, in the current week.
  Both totals use the same eligible records. It does not use target pace or
  average individual paces. Missing/zero measurements do not cause division by
  zero; unavailable pace is displayed as an em dash with an explanation.
- Pace is rounded once to whole seconds and formatted as minutes:seconds per
  mile, including correct minute carry. Mileage cards/table use one decimal;
  chart labels/tooltips display up to two decimals. The underlying sums retain
  their precision.
- Reused the existing paginated, owner-scoped `useWorkouts` loader, including
  its join to `workout_types`, abort handling, and account-scoped state.
  No migration, database schema change, or RLS modification was needed.
  `schema.md` is unchanged.
- Successful create/update/delete operations emit a workout-change event.
  Dashboard data reloads on navigation/mount, full-page reload, that event,
  explicit Refresh, focus, and returning to a visible tab. A visible-page
  60-second poll also detects other-tab/device changes and advances calendar
  weeks without requiring Supabase Realtime publication changes.
- Empty users see zero totals, unavailable pace, and a first-workout action.
  Planned-only/non-running data is distinguished from an entirely empty journal.
  Loading/error states do not present zero totals as successful database results;
  errors include retry.
- The dashboard is lazy-loaded, keeping the Recharts bundle out of the initial
  login/home download. Shared navigation uses a separate row on narrow phones
  without overflowing the page.
- No nutrition, strength-template, wearable, or weekly-planning features were
  implemented.

## Automated tests and exact commands — summary

Run these commands from the project root:

```bash
# All twenty pure dashboard calculation/formatting tests:
npm run test:dashboard

# Only the assignment's required 4 + 5 + 6, excluding planned 8, test:
node --experimental-strip-types --test --test-name-pattern="required dashboard test" tests/dashboard.test.ts

# Repeat the dashboard suite using Pacific local-calendar behavior:
TZ=America/Los_Angeles npm run test:dashboard

# Existing validation/search tests:
npm run test:workout-validation
npm run test:workout-filters

# Production build:
npm run build

# Browser tests, including dashboard, CRUD, favorites, and search:
# Start the existing application workflow first.
npm run test:workout-ui -- --trace off
```

The pure tests use Node's existing test runner, not a live Supabase connection,
and need no test credentials. The required test calls the same calculation
function that the dashboard uses and asserts that its result equals 15.
An incorrect result produces a real assertion failure and nonzero exit status.
The reference week is fixed so this test remains valid after the calendar changes.

Other calculation tests cover all activity types, Monday/Sunday boundaries,
six bins and empty weeks, aggregate rather than mean pace, missing/zero/invalid
measurements, other weeks, year boundaries, daylight-saving dates, rounding,
and input immutability.

Browser tests intercept Auth and PostgREST requests and use controlled records;
they do not create live accounts or modify remote Supabase data. They test
metric values, six chart/table totals, private-record exclusion, phone layout,
empty/planned-only states, errors/retry, page reload, focus, workout-change
events, polling, and totals after actual UI create/edit/delete flows.
Existing logger, favorites, search, and signed-out protection tests are retained.
Traces are disabled for this command to avoid Vite reloading from generated
trace HTML; test artifacts stay under ignored `generated-artifacts/`.

## Capturing genuine failing and passing test screenshots later — instructions

The shipped implementation is correct. No intentional bug or fabricated passing
output is included. For the assignment's demonstration:

1. Open `src/lib/dashboard.ts` and find this guard inside the workout loop:

   ```ts
   if (workout.status !== "completed") continue;
   ```

2. Temporarily replace it with the following **incorrect** condition:

   ```ts
   if (workout.status === "in_progress") continue;
   ```

   This wrongly allows planned runs to contribute. The test data then totals
   4 + 5 + 6 + 8 = 23 rather than 15.

3. Save the file and run the focused command:

   ```bash
   node --experimental-strip-types --test --test-name-pattern="required dashboard test" tests/dashboard.test.ts
   ```

   Capture the actual failing terminal output showing the assertion mismatch.

4. Restore the original completed-only guard, save, and run the **same command**
   again. Capture its actual passing output.
5. Run `npm run test:dashboard` and `npm run build` after restoring the fix.
   Do not commit or push the temporary intentional bug.

## Manual live-account checks — instructions

1. Sign in and open Dashboard. In the current Monday–Sunday week, log completed
   Running workouts of 4, 5, and 6 miles with durations of 32, 50, and 54 minutes.
   Add a planned 8-mile run. If these are the only eligible runs, mileage should
   be **15.0** and aggregate pace **9:04 per mile** (136 minutes / 15 miles).
2. Add completed hiking/cycling/strength workouts: the completed-workout count
   should rise, but running mileage and pace should not change. Planned and
   in-progress entries should not affect any actual-training totals.
3. Check missing distances and durations: no NaN or Infinity should appear.
   Runs with distance but no duration still contribute mileage, not pace.
4. Add completed runs in prior weeks, then expand the chart's table. Confirm six
   Monday–Sunday bins, appropriate totals, and zeroes for empty weeks.
5. Create, edit, change status, and delete a workout, returning to Dashboard
   after each action. Check Refresh and page reload. Changes from another tab
   appear on focus/visibility return or the next visible-page poll.
6. Check phone-size layout, chart labels, table access, and all navigation links.
   Star/unstar a workout and check Starred; try combined search/activity/status
   filters in history.
7. Sign out and try `/app/dashboard`: it must redirect to login. Use a separate
   account to confirm private workouts are not shared.

The agent's browser checks use mocked API responses, so live signed-in Supabase
behavior should be confirmed using these manual steps.

## Initial implementation verification results — summary

- Dashboard calculation suite: ten tests passed, including the exact required
  15-mile test; also passed under `America/Los_Angeles`.
- The focused assignment test command ran successfully on its own.
- Existing validation and search/filter unit suites: all 19 tests passed.
- All 40 desktop/mobile browser cases passed across completed runs, including
  existing CRUD, favorites, and search regressions. The first run's two failures
  were a test selector using the short navigation label on account home, where
  the actual link is named Training dashboard. The selector was corrected and
  both affected cases passed; app behavior did not need changing for that issue.
- Existing local database tests passed constraints, cascade behavior, repeat-run
  migration safety, permissions, and cross-user RLS checks.
- TypeScript and the production build passed. The existing main-bundle size
  advisory remains nonblocking; the chart is in a separate lazy-loaded chunk.
- No production data changes or database migrations were performed.
- Only `feature/dashboard` is authorized for commit/push; no main-branch switch
  or pull-request merge is authorized.

## Average running pace debugging prompt — verbatim

```text
I found a bug while testing the Stride dashboard: **average running pace is incorrect.**

I suspect the calculation is including workouts that aren't runs.

Please investigate and fix this issue on the current `feature/dashboard` branch.

### Requirements

1. Average running pace must include **only completed workouts with activity type Running**.
2. Exclude walking, hiking, cycling, strength training, Pilates, PT, and other activity types.
3. Exclude planned and in-progress runs.
4. Exclude completed runs with missing, zero, or invalid distance or duration.
5. Calculate average pace as **total running duration divided by total running distance**, not the arithmetic average of individual workout paces.
6. Display the result in minutes and seconds per mile (MM:SS/mi).
7. If there are no eligible runs, display a dash rather than an incorrect number.
8. Verify that the weekly mileage chart also includes only completed runs.

### Testing

Add or update automated tests that confirm:
- A completed 5-mile run in 50 minutes gives a 10:00/mi pace.
- Adding a 2-mile walk in 40 minutes does not change that pace.
- Adding a planned run does not change that pace.
- Two completed runs of 5 miles in 50 minutes and 3 miles in 27 minutes produce an average pace of approximately 9:38/mi.

Explain what caused the bug and what you changed.

Document this debugging prompt and the fix in `prompts/dashboard.md`.

Do not change unrelated features. Stay on `feature/dashboard` and do not commit directly to `main`.
```

### Investigation and changes — summary, not a quotation

- Checked the actual branch, pure calculation, Supabase selection with its joined
  `workout_types` name, dashboard hook, and displayed pace. On the clean current
  branch, both mileage and pace already shared a completed-only Running guard.
  Pace additionally checked both measurements were finite and positive and
  divided total eligible duration by total eligible distance.
- Added the exact requested regression examples **before changing application
  code**. All passed against the existing calculation. Consequently, the
  suspected inclusion of other activities was not reproduced, and it would be
  inaccurate to claim that an activity-filter bug was found or fixed.
- Identified a real weakness in the old tests: the non-running examples had the
  same per-mile pace as the run. A pace-only regression could be masked by those
  fixtures. New cases deliberately use a walk at 20 min/mi versus a run at
  10 min/mi, plus planned/in-progress runs with different paces.
- Added explicit exclusion tests for Walking, Hiking, Cycling, Strength
  Training, Pilates, Physical Therapy, PT, Other, and missing type information.
  All six chart bins are checked for non-running contamination.
- Added coverage for missing, zero, negative, NaN, and infinite distance/duration.
  No eligible runs must return null pace and render a dash. A valid run with
  missing duration can still contribute mileage, but never pace.
- Kept the existing, correct eligibility rules, aggregate formula, and
  current-week scope unchanged. The two-run example uses 77 / 8 = 9.625
  minutes/mile, or 577.5 seconds, rounded to **9:38/mi**; an arithmetic mean
  would incorrectly give 9:30/mi.
- Made the display explicitly show `/mi` next to a valid MM:SS value and show
  only a dash when unavailable.
- Exposed the already-computed eligible running duration/distance totals in the
  calculation result and displayed their breakdown plus eligible-run count.
  This lets the user compare the live value with the actual completed Running
  records for the labeled Monday–Sunday week, without sharing account access.
- Added a desktop/mobile browser regression exercising the requested examples,
  chart-table totals, calculation breakdown, and the no-eligible-runs state.
- Follow-up clarification established the reported example as a 4-mile run with
  a duration of 42 minutes. The displayed 10:30/mi is mathematically correct:
  42 / 4 = 10.5 minutes/mile = 10 minutes 30 seconds per mile. This example does
  not demonstrate a calculation defect or inclusion of non-running activities.
  Added that exact case as a regression test and left the correct formula
  unchanged. Live signed-in Supabase records have not been inspected or changed.
- No auth, schema, RLS, logger, favorites, or search behavior was changed.
  This follow-up remains on `feature/dashboard`; it does not authorize another
  commit or push.

### Follow-up verification — summary

- `npm run test:dashboard`: all 17 calculation/formatting tests passed.
- `npx playwright test --trace off -g "dashboard"`: all 12 desktop/mobile
  dashboard cases passed, including the new pace regression and chart checks.
  These use intercepted API responses, not the user's live account.
- `npm run build`: passed TypeScript checking and production build, with the
  existing nonblocking main-chunk size advisory.
- To run just the new pure pace regressions:

  ```bash
  node --experimental-strip-types --test --test-name-pattern="pace regression:" tests/dashboard.test.ts
  ```

- To run dashboard browser checks with the app workflow running:

  ```bash
  npx playwright test --trace off -g "dashboard"
  ```

- In the live preview, refresh Dashboard and compare the eligible-run count and
  `Pace: … minutes ÷ … miles` breakdown with this week's completed Running
  workouts. A zero count must display a dash; a 50-minute/5-mile eligible total
  must display 10:00/mi.

## Weekly and overall statistics follow-up

### User prompt — verbatim

```text
I want weekly stats and overall stats
```

### Changes and decisions — summary

- Dashboard now displays clearly labeled **This week** and **Overall** sections.
  Both show completed running mileage, completed-workout count across all
  activities, and aggregate running pace with eligible-run count and calculation
  details.
- This week retains the local Monday–Sunday date range. Overall includes all
  dates in the authenticated user's journal, including entries older than the
  six-week chart window.
- Both periods use a shared accumulation helper with identical completed-only
  and Running-only mileage/pace rules. Pace is total valid duration divided by
  total matched distance, not an average of the two periods or individual paces.
  Missing/invalid pace pairs remain excluded; unavailable pace is a dash.
- The six-week mileage chart remains weekly and is not changed to all-time.
- Both sections use the same existing owner-scoped, paginated workout data and
  existing refresh behavior. No additional queries, tables, migrations, or RLS
  changes are required.
- Both sections hide final totals on load errors, use safe zero/dash empty
  states, and support desktop/mobile layouts. No unrelated feature was changed.

### Verification and manual checks — summary

- `npm run test:dashboard`: all 20 pure tests passed, covering the earlier pace
  regressions plus distinct weekly/all-time totals, history outside six weeks,
  aggregate weighting, and empty/invalid measurements.
- `npm run build`: passed TypeScript and production build; the existing
  nonblocking main-bundle size advisory remains.
- Browser regression checks cover separate weekly/overall metrics, historical
  entries, exclusion of other-user records, refresh/reload, empty/error states,
  chart scope, and updates after create/edit/delete.
- All 14 selected desktop/mobile dashboard cases passed across completed runs.
  The broad run reached the shell tool's overall time limit after 11 passing
  cases, with no reported test failures; a focused run completed the remaining
  cases. Desktop/mobile screenshots were also reviewed. Browser responses are
  mocked; no live signed-in Supabase account was inspected.
- For a manual comparison, log a completed 5-mile/50-minute run this week and a
  completed 3-mile/27-minute run in an older week. If these are the only runs,
  This week should show 5.0 miles and 10:00/mi; Overall should show 8.0 miles and
  9:38/mi. Adding a completed walk changes workout counts, not running totals.
- The work stays on `feature/dashboard`. This follow-up does not include a
  requested Git commit, push, or merge.
