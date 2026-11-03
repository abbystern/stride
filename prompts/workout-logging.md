# Feature 3: Workout Logging (CRUD)

## Original implementation prompt — verbatim

The following prompt was supplied as an attachment in the Replit conversation:

```text
I'm continuing development of Stride, my all-in-one fitness training app.

Read `PLAN.md`, `schema.md`, and the existing code before making changes.

We are implementing **Feature 3: Workout Logging (CRUD)**.

Current Git branch: `feature/workout-logging`.

IMPORTANT: Build only the workout logging functionality described below. Do not implement the dashboard, stars, weekly planner, lifting templates, nutrition tracking, or recovery features yet.

## 1. Workout creation

Build a mobile-friendly form that lets authenticated users log a workout.

Required fields:
- Workout title
- Date
- Activity type
- Status: Planned, In Progress, or Completed

Activity types:
- Running
- Strength Training
- Cycling
- Pilates
- Physical Therapy
- Walking
- Hiking
- Other

Optional fields:
- Distance (miles)
- Duration (minutes)
- Elevation gain (feet)
- Notes

For running workouts, also show:
- Run type: Easy/Base, Recovery, Long Run, Tempo/Threshold, VO2 Max, or Sprints/Strides
- Target pace

Use the existing `workouts` and `workout_types` tables in Supabase. Do not create duplicate tables.

## 2. Workout history

Create a workout list where users can see their saved workouts.

Each item should display:
- Workout title
- Date
- Activity type
- Status
- Distance and duration, when applicable

Include a way to open an individual workout's detail page.

## 3. Edit workouts

Users should be able to open a saved workout, edit its information, and save the changes.

Updates must persist in Supabase and remain visible after refreshing the page.

## 4. Delete workouts

Users should be able to delete saved workouts.

Before deletion, show a confirmation asking whether they're sure.

After confirmation, remove the workout from Supabase and update the interface.

## 5. Validation

- Require title, date, activity type, and status.
- Reject blank titles and negative numeric values.
- Show friendly error messages near the relevant fields.
- Prevent invalid entries from being saved.
- Show a useful error message if a database operation fails.

## 6. User privacy

Every workout must belong to the currently authenticated user.

Use the existing Supabase Row Level Security policies.

Users must never be able to view, edit, or delete another user's workouts.

Do not weaken or disable RLS.

## 7. Design

Follow Stride's existing design:
- Warm white background
- Dark charcoal text
- Muted sage green accents
- Clean typography
- Simple, understated layout

Make the workout form practical to use on a phone.

Add clear navigation between the authenticated home screen and workout history.

## 8. Documentation

Create `prompts/workout-logging.md`.

Include:
- This implementation prompt
- Summary of work completed
- Important design decisions
- Bugs encountered and fixes
- Follow-up prompts, if any

Use verbatim prompts when available and label summaries appropriately.

Update `schema.md` only if the actual database structure changes.

## 9. Verification

Before finishing:
- Confirm the app builds successfully.
- Check that workouts can be created, read, updated, and deleted.
- Confirm required fields and numeric validation work.
- Confirm workout records persist in Supabase.
- Explain how I should manually test the feature.

Stay on `feature/workout-logging`.

Do not commit directly to `main` or push changes to GitHub yet.

Do not implement unrelated features. We are keeping each feature in a separate pull request for my coding assignment.
```

## Work completed — summary

- Added protected workout history, creation, detail, and editing pages at
  `/app/workouts`, `/app/workouts/new`, `/app/workouts/:id`, and
  `/app/workouts/:id/edit`. Added home/history/new-workout navigation.
- Connected the forms to the existing Supabase `workouts` and `workout_types`
  tables, including all eight activities, three statuses, optional measurements,
  notes, and conditional running fields.
- Added confirmed deletion with cancellation, pending state, error feedback, and
  history refresh after success.
- Added shared form validation, loading/empty/not-found states, and retryable
  database errors. Failed saves keep the entered form values.
- Added validation unit tests and desktop/mobile browser tests. Browser tests
  intercept Auth/PostgREST requests; they do not create real accounts or write
  remote Supabase data.
- Kept the existing authentication, session persistence, Vite preview-host
  restriction, database schema, and RLS. No migration was added or changed, and
  `schema.md` was not changed.
- Did not implement dashboards, stars, weekly planning, lifting templates,
  nutrition, or recovery.

## Important design and security decisions — summary

- Retained the existing warm-white, charcoal, and sage theme, with responsive
  forms, explicit measurement units, field labels, and inline validation.
- Activity IDs come from Supabase rather than hardcoded seed IDs.
- Optional measurements are saved as `null` when blank; actual zero values are
  retained. Negative and nonfinite numbers, invalid dates, blank titles, and
  missing/unknown required selections are rejected before a request is sent.
- Dates are handled as calendar dates rather than converted through UTC when
  initializing or displaying a workout.
- Running-only fields are shown for Running and cleared in the saved payload
  when changing to another activity.
- Creation obtains `user_id` from the authenticated session. Reads, updates, and
  deletes also filter by that user ID; the existing Supabase RLS remains the
  database-level privacy boundary. Updates do not send a new owner.
- Updates and deletes check the returned rows instead of reporting success when
  no accessible row was changed. Inaccessible records use the same not-found
  response as missing records.
- Requests are cancelled when a view changes, and previously loaded records are
  not shown for another signed-in user or another workout ID.
- No service-role key or authentication bypass was introduced. Test fixtures
  use synthetic, nonfunctional credentials only.

## Bugs encountered and fixes — summary

- The untyped Supabase client inferred the joined `workout_types` relationship
  as an array, while this foreign-key relationship returns one object per
  workout. Explicit result-type overrides fixed the TypeScript errors. The
  request abort signal is attached before the final type override, as required
  by the Supabase query-builder types.
- Removed a nested link around the existing linked brand component and made
  the history navigation use exact matching.
- The downloaded Playwright browser could not launch in Replit because its
  Linux shared-library runtime was unavailable. The test configuration now
  uses Replit's existing Chromium wrapper when available, with an executable
  override for other environments.
- Browser-test exact label selectors initially included required-field marker
  text. Prefix label selectors fixed the test mismatch without changing the
  application. The eight-activity test received a longer timeout because it
  visits and saves eight separate forms through the preview proxy.
- These were integration/test-harness issues. The user reported no remaining
  Feature 3 application bug in the final manual test.

## Verification — summary

- `npm run build`: passed TypeScript checking and the Vite production build.
  Vite reports a nonblocking bundle-size advisory.
- `npm run test:workout-validation`: all nine tests passed.
- `bash scripts/test-workout-database.sh`: passed the existing migration,
  repeat-run safety, constraints, permissions, and cross-user RLS tests in a
  disposable local PostgreSQL database.
- All fourteen desktop/mobile browser cases passed across the final completed
  runs. Browser tests cover CRUD, reloads, confirmation/cancellation, database errors,
  required fields, negative measurements, all activities, hidden running fields,
  inaccessible records, and signed-out route protection on desktop and mobile.
  These are API-contract tests, not evidence of remote Supabase writes.
- The user independently confirmed the real signed-in Supabase flow, including
  persistence after refresh. The exact report appears below.

## Follow-up finalization prompt and manual results — verbatim

```text
Feature 3: Workout Logging is working.

I manually tested:
- Creating a running workout
- Opening the workout and viewing its details
- Editing the workout and saving the changes
- Deleting the workout with confirmation
- Refreshing to verify the changes persisted
- Validation for missing required fields and negative distance values

Please finalize this feature.

1. Ensure `prompts/workout-logging.md` exists and documents the original implementation prompt, changes made, and manual testing results. Include follow-up prompts and bugs if applicable.
2. Check that the app builds successfully.
3. Confirm we're on `feature/workout-logging`.
4. Check that no `.env` files, passwords, or secrets are included in the Git changes.
5. Commit the feature changes with the message `Add workout logging and validation`.
6. Push `feature/workout-logging` to GitHub.

Do not switch to `main`, merge anything, or implement additional features.

When finished, tell me whether the commit and push succeeded.
```

## Manual regression checklist — summary

1. Log in and open Workout history from the authenticated home.
2. Create a Running workout with title, date, activity, and status; optionally add
   a run type, pace, measurements, and notes.
3. Open its detail page, refresh, and confirm the saved values remain.
4. Edit its title/status/measurements, save, refresh, and check the history.
5. Try a whitespace-only title, missing required fields, and negative
   measurements. Confirm inline errors appear and no invalid record is saved.
6. Delete a workout, cancel once to retain it, then confirm deletion and refresh.
7. With a second account, verify the first account's history and direct workout
   URLs are inaccessible. Log out and verify protected URLs return to login.
8. Optionally inspect `public.workouts` in Supabase to confirm ownership and the
   corresponding create/update/delete operations.

No follow-up prompt to add unrelated functionality was given.
