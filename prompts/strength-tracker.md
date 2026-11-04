# Feature 9: Interactive Strength Training and Progressive Overload

## Original prompt — verbatim

```text
I'm implementing Feature 9: Interactive Strength Training and Progressive Overload for Stride.

Read PLAN.md, schema.md, and the existing workout database, workout logging, and calendar code.

Work only on branch `feature/strength-tracker`.

Build a mobile-friendly strength workout tracker that allows users to follow lifting routines and log weights and reps while working out.

### 1. Reusable workout templates

Users can create named strength templates, such as Upper A, Lower A, or Posterior Day.

For each template, users can add exercises with:
- Exercise name
- Exercise order
- Target number of sets
- Minimum and maximum target reps
- Optional exercise notes

Users can edit and reuse templates.

### 2. Interactive workout logging

Users can:
- Start a strength workout from a template.
- See the exercise list and target sets/reps.
- Enter actual weight and reps for each set.
- Mark each set completed.
- Save progress without losing entries when refreshing.
- Finish the workout and view the completed results.

Use existing workout records where possible. Do not create a separate, disconnected workout system.

### 3. Progressive overload

For each exercise, show the user's most recent completed performance, including weight and reps.

For example:

Chest Press
Target: 3 × 8–10
Previous: 65 lb × 10

Allow users to compare their current session with the previous one.

No advanced progression charts or automatic weight recommendations are necessary.

### 4. Database

Use the database structure described in PLAN.md.

Create the necessary Supabase tables for:
- Workout templates
- Exercises
- Template exercises
- Workout sets

Include foreign keys, appropriate validation, and Row Level Security.

Save all database changes in a new numbered SQL migration.

Do not modify existing migrations that have already been applied.

### 5. Security

Ensure users can only view and modify their own templates, exercises, and workout sets.

Do not disable RLS or expose other users' training data.

### 6. Design

Follow Stride's existing design.

Prioritize:
- Large, easy-to-use input fields
- Simple set completion checkboxes
- Clear exercise headings
- Previous performance displayed near the current entry
- Good mobile usability

### 7. Documentation and testing

Create `prompts/strength-tracker.md`.

Update `schema.md` with the actual new tables and relationships.

Run the build and check for errors.

Explain how I can test:
1. Creating a workout template
2. Starting a workout
3. Logging weights and reps
4. Refreshing without losing progress
5. Completing the workout
6. Viewing previous performance

Do not implement Garmin, Oura, nutrition, or unrelated features.

Do not commit directly to main.

When finished, commit and push only `feature/strength-tracker`. Do not merge it.
```

## Implementation — summary, not a verbatim response

- `/app/strength` provides named reusable routines, ordered exercises, set and
  rep targets, notes, add/remove controls, and move-up/down buttons.
- `/app/workouts/:id/strength` provides large set inputs, completion checkboxes,
  previous completed performance, **Save progress**, **Finish workout**, and
  persisted completed results. Owner/workout keys isolate local drafts.
- Strength links are added to the existing home/navigation and Strength
  workout details. Existing History and Calendar use the same workout rows.
- A dated routine start creates an ordinary in-progress Strength workout.
  An existing planned/in-progress Strength workout can instead **Use template**,
  preserving its ID, title, date, and notes. Initialized sessions are not reset.
- Starting copies exercise names/order/targets/notes into session sets.
  Editing the reusable routine later never rewrites active or completed sets.
- Exercise identity is reused within the same account by trimmed/case-insensitive
  name. Different users never share private exercise records.
- Progress is an explicit confirmed save, not an autosave claim. The UI labels
  unsaved changes, warns before refresh with dirty drafts, and tells users to
  save before leaving. Failed requests retain drafts and do not claim success.
- Finish atomically saves entered progress and completes the existing workout.
  It requires at least one completed set; remaining sets stay uncompleted.
  Completed sets require finite nonnegative pounds and positive whole reps.
- Prior performance means the most recent earlier completed workout for that
  exercise, showing its completed weights/reps and date—not a personal best or
  recommendation. Current/future/in-progress sessions and incomplete sets are
  excluded. First-time exercises show no prior performance rather than estimates.
- No Garmin/Oura integration, nutrition, recommendations, or progression charts
  were added.

## Database and deployment

New `supabase/migrations/005_strength_tracker.sql` defines:

- `workout_templates`, `exercises`, `template_exercises`, and `workout_sets`.
- Nullable `workouts.template_id`, composite owner FKs, bounds/uniqueness
  constraints, snapshot fields, and Strength-activity validation.
- Owner-only RLS, including parent ownership for child rows. Anonymous access
  is denied; all RPCs run as the caller, not as a security-definer bypass.
- Atomic template saves, session initialization, progress/finish, and private
  prior-performance lookup.

Migrations **001–004 are unchanged**. Apply 005 manually in the existing
Supabase SQL Editor after them. The agent has not applied SQL remotely.
Existing shared workout queries do not require the new column, so other
features can still load before the new migration is applied. Strength routes
show a useful migration-specific setup error until it exists.

See `schema.md` for actual fields, constraints, relationships, permissions,
delete behavior, limits, and function semantics.

## Development checks and fixes — summary

- Checked local database behavior with two synthetic identities and real RLS.
  Template edits, progress, and starting sessions are transactional; invalid
  batches roll back without partially overwriting a workout.
- Added a strength-specific error mapper to the existing resource hook so
  missing tables/functions correctly identify migration 005, not migration 002.
- Initializing a routine on an already-open generic Strength workout resets the
  local initialization guard, so its newly created set inputs are editable.
- Browser testing caught an imprecise accessible label on the template chooser;
  it now has an explicit **Strength template** label.
- Captured targets remain unchanged when a template is edited. Completed
  sessions can be reviewed without fabricating sets for older generic workouts.

## Automated verification

```sh
node --experimental-strip-types --test tests/*.test.ts
bash scripts/test-workout-database.sh
npm run build
npx playwright test tests/browser/strength.spec.ts --trace off
```

The SQL harness uses disposable PostgreSQL, not Supabase. Browser Auth and
PostgREST are intercepted with synthetic data; these are not live-account
tests. Desktop/mobile screenshots are generated under ignored
`generated-artifacts/`, not committed.

Results on November 4, 2026:

- Build passed; Vite's existing large-chunk advisory remains nonblocking.
- All 51 unit/calculation/validation tests passed.
- The full disposable PostgreSQL migration/RLS/constraint/RPC suite passed,
  including strength snapshots, progress rollback, prior performance and
  profile cascades.
- All 10 strength browser cases were verified on desktop/mobile: eight
  passed initially, then the two template-attachment cases passed after the
  accessible-label fix in a focused rerun.
- Two existing dashboard weekly/overall regression cases also passed.
- Inspected desktop/mobile signed-in tracker screenshots with intercepted
  synthetic data. The public preview correctly redirects logged-out visitors
  to sign-in. No real-account manual strength tests have been claimed.

## Manual test guide

1. Run migration 005 in Supabase, sign in, and open **Strength**.
2. Click **New template**, name it **Upper A**, and enter **Chest Press**,
   3 sets, reps 8–10, with optional notes. Add another exercise, move its order,
   and save. Edit it to verify saved targets and order load correctly.
3. Choose a workout date and click **Start Upper A**. Verify the normal
   workout also appears in History/Calendar as Strength Training.
4. Enter **65 lb**, **10 reps** for a set and mark it completed. Enter any
   other desired sets. Click **Save progress** and wait for **Progress saved**.
5. Refresh. Confirm weights, reps, and checkboxes persisted. Try weight zero
   for an unweighted set; negative/nonfinite weights or fractional reps must
   not save. Completed sets cannot be blank.
6. Click **Finish workout** and accept confirmation. Review saved results,
   refresh again, and confirm the workout is completed in History/Calendar.
   Unfinished sets remain visibly uncompleted.
7. Start the same routine on a later date. Chest Press should show the earlier
   completed session's weight/reps/date next to its fresh entries. Complete a
   later session with different values and verify that, not a personal best,
   becomes the next session's previous performance.
8. Create a generic planned Strength workout on the calendar, open its details,
   click **Track strength workout**, select a routine, and **Use template**.
   Confirm no duplicate workout is created and its date/title/notes remain.
9. Edit a routine after starting a session; return to that session and verify
   its original targets and logged entries did not change.
10. With a separate account, confirm the first account's routines, exercises,
    sets, and prior performance are inaccessible. Check mobile layout and
    failure/retry feedback. Do not disable RLS.

## Delivery

The implementation remains on `feature/strength-tracker`. Only that branch is
to be committed/pushed; no merge or commit on main is included. The final
conversation response reports the actual Git delivery result.

## Preview runtime follow-up

User prompt — verbatim:

> The Start application artifact crashed with a runtime error, please debug and fix it.

Diagnosis and fix — summary:

- Browser logs reported an invalid hook call and a failed dynamic import of
  the strength templates page. React and React DOM had matching, deduplicated
  installed versions.
- Two Vite processes were running. The newer process fell back to port 5001
  while the preview still used port 5000.
- Stopped the managed workflow and the remaining orphaned Vite process, then
  restarted one managed server on port 5000.
- Configured Vite's host, port 5000, and `strictPort: true` so future conflicts
  fail clearly rather than silently changing ports. The restricted
  `.replit.dev` host allowlist, authentication, and Supabase logic are unchanged.
- Build passed. Four desktop/mobile browser checks passed for strength page
  loading, saved progress after refresh, completion, prior results, and
  protected-route handling, using synthetic Supabase responses. A fresh public
  preview loaded the expected sign-in screen without the runtime error.
- Reload an already-open preview to discard its old development module state.
