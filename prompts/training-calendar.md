# Custom Feature 1: Flexible Weekly Training Calendar

## Original implementation prompt — verbatim

```text
I'm implementing Custom Feature 1: Flexible Weekly Training Calendar for Stride.

Read PLAN.md, schema.md, and the existing workout, authentication, and dashboard code.

Work only on branch `feature/training-calendar`.

Build a responsive weekly workout calendar using the existing Supabase workouts table.

Requirements:

1. Show a Monday–Sunday weekly calendar with previous-week, next-week, and current-week navigation.
2. Display each planned, in-progress, or completed workout on its scheduled date.
3. Use clear labels for activity type, workout title, and status.
4. Allow users to click workouts to open their existing detail/edit interface.
5. Allow users to reschedule workouts by choosing a new date. Save the updated date in Supabase immediately.
6. Allow users to add a workout to a selected day using the existing workout creation form.
7. Calculate scheduled running mileage from planned and in-progress Running workouts only.
8. Calculate completed running mileage from completed Running workouts only.
9. Display a weekly running mileage goal. For the first version, allow users to enter and save a goal for each week using a simple weekly_goals table with user_id, week_start, and target_miles. Include RLS and a SQL migration if a new table is needed.
10. Ensure walking, hiking, cycling, and other non-running activities never contribute to running mileage.
11. Show a friendly empty state on days without workouts.
12. Design for desktop and mobile, using Stride's existing cream, charcoal, and sage visual style.

Keep this first version simple: no drag-and-drop, AI training recommendations, automatic Garmin imports, or complex scheduling algorithms.

Document the work in `prompts/training-calendar.md`. Update schema.md for any database additions.

Run the build and explain how I can test the calendar, rescheduling, and mileage totals.

Do not commit directly to main. Commit and push only the feature branch once the implementation is complete, without merging it.
```

## Branch follow-up

User's follow-up — verbatim:

```text
you're now on the correct branch
```

Summary: the working branch was changed to
`Feature-8-Flexible-Weekly-Training-Calendar`. The agent confirmed the active
branch and continued there, honoring the user's correction instead of switching
back to the originally named branch. No work is merged into or committed on
`main`.

## Implementation — summary, not a verbatim conversation quotation

- Added the protected, lazy-loaded `/app/calendar` route, Calendar navigation,
  and a responsive Monday–Sunday view using the existing visual style.
- Week selection is preserved in `?week=YYYY-MM-DD`. Previous/next navigation
  moves seven calendar days; This week uses the current local calendar.
  Non-Monday valid dates normalize to Monday, and invalid query dates fall back
  safely to the current week.
- Every workout appears on its existing scheduled date, with title, activity,
  and status. Clicking a title opens the existing detail page, whose Edit
  workout link is unchanged. Empty days have an explanatory message.
- Reschedule opens a date picker. **Save date** immediately sends a date-only
  Supabase PATCH for the authenticated owner's workout and reloads data after
  success. There is no batch save or drag-and-drop. Failed writes retain the
  original date and show retryable feedback; missing workouts do not report
  false success.
- Each day's Add workout link opens the existing creation form with that date
  prefilled. Normal creation validation and detail-page navigation remain.
- Pure calendar calculations distinguish scheduled Running mileage
  (`planned` + `in_progress`) from completed Running mileage (`completed`).
  Non-running, missing-type, negative, and nonfinite distances never contribute.
  Duration is not required for mileage. Neither total includes adjacent weeks.
- Added `weekly_goals` with an owner/week unique constraint, Monday-only dates,
  finite nonnegative targets, profile-deletion cascade, and owner-only SELECT,
  INSERT, and UPDATE RLS. Saving uses an upsert; no row is **Not set**, while
  zero is a real saved goal. No existing workout/auth/favorite policy changed.
- Goal loading errors do not block workout/calendar use. Missing-table errors
  identify the migration; failed goal saves preserve entered values and never
  claim success. Goal requests are aborted/keyed by user and week to avoid
  showing stale results. View-specific form feedback is guarded across changes.
- Explicitly excluded templates, recommendations, drag-and-drop, Garmin
  imports, complex scheduling, and additional planned features.

### Files

- `src/lib/calendarModel.ts`: local dates, week grouping, mileage, goal validation.
- `src/lib/weeklyGoals.ts`, `src/hooks/useWeeklyGoal.ts`: owner-scoped reads,
  upserts, errors, and user/week request isolation.
- `src/hooks/useTrainingCalendar.ts`: combines existing workout resources with
  weekly goals and calendar totals.
- `src/lib/workouts.ts`, `src/hooks/useWorkouts.ts`: date-only rescheduling
  through the existing authenticated mutation/event flow.
- `src/pages/TrainingCalendarPage.tsx`, `src/calendar.css`: calendar interface.
- Existing route/navigation and workout-create files: minimal wiring/prefill.
- `supabase/migrations/004_training_calendar.sql`: new goals table and policies.
- `supabase/tests/004_training_calendar.sql`, `scripts/test-workout-database.sh`:
  disposable local security and migration checks.
- `tests/calendar.test.ts`, `tests/browser/calendar.spec.ts` and its synthetic
  backend helper: calculation and UI/API-contract regression checks.
- `schema.md`: new table, security, migration status, and application instructions.

## Supabase setup required

The agent supplies and tests the SQL locally; this does **not** apply it to
remote Supabase. Run the complete `supabase/migrations/004_training_calendar.sql`
in the existing project's Supabase SQL Editor after migrations 001–003.
Do not disable RLS or add a service-role key to Vite. Until the migration is
applied, workouts can still be viewed/rescheduled, and goal controls show an
actionable setup error rather than pretend the goal was saved.

## Automated verification

```sh
# Calendar and existing pure regression suites:
node --experimental-strip-types --test tests/*.test.ts

# Disposable local SQL: constraints, upserts, RLS, owner-only rescheduling,
# anonymous/identity-less access denial, rerun safety and cascades:
bash scripts/test-workout-database.sh

# TypeScript and production bundle:
npm run build

# Running development workflow required; browser Auth/PostgREST are mocked:
npx playwright test tests/browser/calendar.spec.ts --trace off
```

Browser scenarios cover Monday–Sunday navigation, week boundaries, activities
and statuses, privacy, existing detail/edit links, selected-day creation,
rescheduling within/across weeks, reload persistence, failure/retry behavior,
per-week goals including zero, upserts, missing migration recovery, invalid
inputs, route protection, and responsive layouts. These tests do not create
real accounts or access live private Supabase data.

## Manual testing guide

1. Apply migration 004 in Supabase and sign in. Open **Calendar**.
2. Check seven days in Monday–Sunday order. Navigate Previous week, Next week,
   and This week; refresh to verify the selected week stays selected.
3. Use Add workout on a day. Confirm the existing form is prefilled with that
   date, create a Running workout, and return via Calendar or browser Back.
4. In one week create: a planned 4-mile run, an in-progress 2-mile run, and a
   completed 3-mile run. Expect **scheduled 6.0 mi**, **completed 3.0 mi**.
5. Add Walking, Hiking, Cycling, Strength, Pilates, or PT workouts with
   distances. They appear on their days but do not change running totals.
6. Save a goal of 15.5 miles, refresh, and confirm it persists. Save another
   goal in the following week, including zero if desired. Switching weeks must
   restore each week's own goal.
7. Reschedule the planned 4-mile run within the same week. Its day changes;
   scheduled mileage stays 6.0. Verify title/status/distance/notes are unchanged.
8. Move that run to the following week. The first week's scheduled mileage
   becomes 2.0; the next week's increases by 4.0. Goals do not move with it.
9. Move the completed 3-mile run to the following week. Completed mileage
   leaves the original week and enters the new one; scheduled totals do not
   change. Refresh and inspect the detail page to verify persistence.
10. Click a workout, then Edit workout, and verify the existing edit flow works.
11. Test an empty day, empty week, blank/negative goal, and a failed request.
    Errors must not silently turn unavailable data into real zeroes or show a
    successful save. Restore connectivity and retry.
12. Check desktop and a narrow mobile viewport for readable cards/navigation
    and no horizontal page overflow. Test a second account for isolation.

## Verification results and Git delivery

- All **46** pure calculation/filter/validation tests passed, including all
  **7** new calendar tests and existing dashboard regressions.
- The disposable local PostgreSQL suite passed: migrations, repeated application,
  owner-only reads/upserts, uniqueness, date/mileage constraints, no cross-owner
  rescheduling, denied anonymous/identity-less access, and deletion cascades.
- `npm run build` passed TypeScript and Vite production compilation. Vite's
  existing nonblocking main-chunk size advisory remains.
- All **16** desktop/mobile calendar browser cases passed across completed runs,
  including the calendar-to-dashboard completed-workout rescheduling regression.
  The first broad run passed 12 cases; two read-failure assertions initially
  waited only five seconds while the SDK was still retrying HTTP 503 reads.
  Their wait now accommodates the SDK's backoff, and both reruns passed without
  disabling production retries. The two additional dashboard integration cases
  also passed.
- Desktop/mobile screenshots were reviewed. The unauthenticated preview
  correctly shows sign-in; no live signed-in Supabase account was inspected.
- Remote goal migration and signed-in live-data checks remain manual until
  confirmed by the user. Browser fixtures and local SQL are not live Supabase
  tests.

Git delivery targets only `Feature-8-Flexible-Weekly-Training-Calendar`, with the
feature commit message `Add flexible weekly training calendar`. No merge or
commit on `main` is part of this feature. The final delivery message reports
the actual commit/push outcome after those commands finish.
