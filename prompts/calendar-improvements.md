# Calendar improvements

## Original implementation prompt — verbatim

```text
I'm implementing a usability improvement to Stride's existing training calendar, based on feedback from a first-time user.

Read `PLAN.md`, `schema.md`, and the existing calendar and workout code before making changes.

Work only on branch `feature/calendar-improvements`.

IMPORTANT: Improve the existing calendar rather than building a separate scheduling system. Preserve all existing workout logging, strength tracking, and dashboard functionality.

## 1. Visual calendar

Replace the current list-only calendar with an actual calendar grid.

- Default to a Monday–Sunday weekly view.
- Show actual dates at the top of each day.
- Display scheduled workouts within the correct date cells.
- Show activity type, workout name, and scheduled time.
- Allow users to navigate between weeks.
- Include a month view if reasonably straightforward.
- Allow multiple workouts on the same day.
- On mobile, use a readable layout rather than squeezing seven tiny columns onto the screen.

Preserve weekly mileage goals and the scheduled-versus-completed mileage summary.

## 2. Workout times

Allow users to add an optional scheduled start time to a workout.

- Users can enter or edit a date and time.
- Show times in a readable 12-hour format.
- Workouts without times should still display correctly.
- Avoid timezone bugs that shift workouts to the wrong day.
- Create a new numbered Supabase migration if a database change is required.

## 3. Rest-day scheduling

Add "Rest Day" as an option when scheduling.

Users should be able to:
- Select a date and schedule a rest day.
- Add optional notes.
- See the rest day displayed distinctly on the calendar.
- Edit, reschedule, or delete it.

Rest days must not count toward running mileage, average pace, or completed workout statistics.

Reuse existing tables and CRUD functionality where practical.

## 4. Calendar interactions

- Selecting a date should make it easy to add a workout or rest day.
- Selecting an existing workout should open its details or editing interface.
- Users should be able to reschedule existing entries.
- Completed workouts should remain visually distinguishable from planned workouts.

## 5. Security and validation

Preserve Supabase authentication and Row Level Security.

Ensure users only see and modify their own workouts.

Validate dates and optional times. Preserve existing workout validation requirements.

## 6. Design

Use Stride's current visual style: warm white, dark charcoal, and muted sage.

Keep the calendar clean, readable, and appropriate for a training-planning app.

Avoid unnecessary animations or a major redesign.

## 7. Documentation

Create `prompts/calendar-improvements.md` containing:
- This original prompt
- Implementation decisions
- Any bugs and debugging prompts
- Testing and verification results

Update `schema.md` if the database changes.

Document the usability-testing motivation: a professional athlete using the app for the first time requested explicit rest-day scheduling and easier calendar-based planning.

## 8. Verification

Run the production build and verify:

1. Calendar dates and workout placement are correct.
2. Users can navigate between weeks.
3. Workout start times can be saved and edited.
4. Multiple workouts can appear on the same day.
5. Rest days can be added, moved, and deleted.
6. Rest days don't affect mileage or completed workout counts.
7. Weekly mileage goals and completed/scheduled totals remain accurate.
8. Data persists after refreshing.
9. Existing workout logging and strength tracking still work.

Explain any SQL migration I need to apply in Supabase.

Do not implement Google Calendar, Garmin, Strava, Oura, nutrition tracking, or unrelated features.

Do not commit directly to main.

When finished, commit and push only `feature/calendar-improvements`. Do not merge the PR.
```

## Motivation

A professional athlete using Stride for the first time requested explicit
rest-day scheduling and easier calendar-based planning. This change improves
the existing calendar instead of introducing a separate scheduling system.

## Implementation decisions — summary, not verbatim responses

- Monday–Sunday weekly view remains the default. Desktop uses a seven-column
  grid; mobile stacks readable date cells. A month toggle adds a six-row
  Monday–Sunday grid, including muted adjacent-month dates.
- Dates have direct workout/rest-day actions. Cards link existing details
  and retain date-only rescheduling. Multiple cards sort by start time, with
  untimed entries last, then title/ID.
- Activity, title, 12-hour time or **No time set**, and status remain visible.
  Rest days and completed workouts have distinct labels/styles.
- Goals remain weekly, even in month view. Selecting a date selects its
  Monday–Sunday summary; an explicit scope label prevents mistaking those
  totals for monthly statistics.
- `workouts.scheduled_start_time` is an optional **local wall-clock** time.
  Date and time are never combined into a UTC timestamp. Forms use HH:MM;
  details/calendar render values such as 6:30 AM or 11:45 PM.
- Rest Day is a real shared activity type, stored in the existing workouts
  table. Existing create/edit/delete/reschedule interfaces retain ownership
  checks and confirmations. Notes are optional, and sports-only fields are
  cleared rather than leaving invisible stale metrics.
- Both the client and database enforce valid time values. Database validation
  rejects Rest Day sport metrics or a strength template. Existing strength
  template/set invariants remain active.
- Dashboard weekly and overall completed-workout counts explicitly exclude
  Rest Day. Mileage/pace still include only eligible Running records.
- The shared read selection tolerates a schema without the optional time
  column. Untouched time inputs are omitted from legacy writes; timed writes
  without migration 006 fail with actionable feedback, not a fake success.
- No new dependency, external calendar/wearable service, recommendation system,
  nutrition feature, or RLS bypass was introduced.

## SQL setup

Run `supabase/migrations/006_calendar_improvements.sql` in the existing
Supabase SQL Editor after 001–005, then reload the app.

The migration adds the optional time column, seeds Rest Day, installs its
validation trigger, and refreshes PostgREST's schema cache. Earlier migrations
and existing workouts/RLS policies are unchanged. This implementation does not
claim to have applied SQL to the remote Supabase project.

## Development/debugging record

Summaries unless specifically marked as quotations:

- The first attachment was cut off at “Use Str” in section 6. The agent asked
  for the remaining instructions before editing; the user supplied this
  complete prompt.
- Changing to a schema-adaptive `SELECT *` exposed a Supabase TypeScript
  inference issue for single results. Explicit result types on the SDK's
  `single`/`maybeSingle` methods preserve the existing request behavior without
  unsafe casts or weakening ownership filters.
- Automated browser fixtures were extended to support real-shaped workout
  edits/deletions and missing-migration responses, while retaining owner
  assertions and date-only reschedule checks.
- No additional user-reported debugging prompt has been received for this
  improvement. Final testing results are recorded below after verification.
- The old navigation regression expected the former **This week** label.
  Updated that locator to **Current week**, retaining all navigation,
  placement, privacy, and layout assertions; both desktop/mobile reruns passed.

## Verification commands

```sh
npm run build
node --experimental-strip-types --test tests/*.test.ts
bash scripts/test-workout-database.sh
npx playwright test tests/browser/calendar-improvements.spec.ts tests/browser/calendar.spec.ts tests/browser/strength.spec.ts --trace off
```

The database harness uses disposable PostgreSQL. Browser tests intercept
Auth/PostgREST with synthetic records; they are not live-account tests.
Generated screenshots are stored under ignored `generated-artifacts/`.

### Results — November 4, 2026

- Production build passed. The existing Vite large-chunk advisory remains
  nonblocking.
- All **56** unit/calculation/validation tests passed.
- The complete local PostgreSQL suite through migration 006 passed, including
  repeat-run safety, unchanged owner-only RLS, rest-day validation, local-time
  constraints, timezone stability, and strength-time preservation.
- All **34 calendar/strength desktop/mobile cases** were verified: 32 passed
  in the initial run, and the two old navigation cases passed after updating
  their button-label locator. Two additional existing dashboard weekly/overall
  regression cases also passed.
- Visually inspected desktop/mobile calendar screenshots. A fresh public
  preview correctly showed sign-in for a logged-out visitor.
- Signed-in verification used synthetic Supabase responses; live-account
  manual testing and remote migration application are not claimed.

## Manual checks after migration

1. Sign in and open **Calendar**. Check Monday–Sunday dates, previous/next/
   current week, and readable desktop/mobile layouts.
2. Add two workouts on the same date at 6:30 AM and 6:15 PM. Add one without a
   time. Verify order and placement, open each detail page, and refresh.
3. Edit a time, then clear it and save. Confirm the selected calendar date
   does not move. Date-only rescheduling must retain any saved start time.
4. Choose **Add rest day** on a date, add notes and an optional time, save,
   edit, reschedule, and delete with confirmation.
5. Mark a rest day completed. Weekly/overall completed-workout counts,
   running mileage, and average running pace must remain unchanged.
6. Add planned/in-progress and completed runs; check scheduled versus
   completed totals and save a weekly goal. Switch weeks and refresh.
7. Switch to **Month** and select dates in different weeks. Verify the
   weekly goal and running totals correspond to the explicitly selected week.
8. Open an existing strength session, save a set, refresh, finish, and view
   results/previous performance. Starting or attaching a routine must retain
   a previously scheduled time.
9. Use a second account to verify private workout/rest-day records cannot be
   accessed or modified. Do not disable RLS.
