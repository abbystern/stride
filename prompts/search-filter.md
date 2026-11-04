# Feature 6: Search, Filter, and Sort Workouts

## Implementation prompt — verbatim

The user supplied this prompt as an attachment:

```text
I'm continuing development of Stride, my fitness training web app.

Read `PLAN.md`, `schema.md`, and the existing workout logging code before making changes.

We are implementing **Feature 6: Search, Filter, and Sort Workouts**.

Current Git branch: `feature/search-filter`.

IMPORTANT: Implement only search, filtering, and sorting. Do not build dashboards, weekly planning, nutrition, strength tracking, or other features yet.

## 1. Search

Add a search bar to the workout history page.

- Allow users to search workouts by title.
- Search should be case-insensitive.
- Results should update as the user types.
- Include a clear-search option.

## 2. Filters

Add filters for:

**Activity type:**
- All activities
- Running
- Strength Training
- Cycling
- Pilates
- Physical Therapy
- Walking
- Hiking
- Other

**Workout status:**
- All statuses
- Planned
- In Progress
- Completed

Filters must work together. For example, I should be able to find completed running workouts with "tempo" in the title.

## 3. Sorting

Allow users to sort workouts by:

- Newest first (default)
- Oldest first
- Longest distance first

Workouts without distances should appear after workouts with distances when sorting by distance.

## 4. Empty states

If no workouts match the search or filters, display a friendly message such as:

"No workouts match your search. Try adjusting your filters."

Provide an easy way to clear the filters.

## 5. Security and data

Use the existing Supabase `workouts` and `workout_types` tables.

Do not create new database tables or change existing RLS policies.

Only display workouts belonging to the authenticated user.

## 6. Design

Keep the search and filter controls clean, compact, responsive, and consistent with Stride's existing design.

They should be easy to use on mobile without taking up too much space.

## 7. Documentation

Create `prompts/search-filter.md` containing:
- This implementation prompt
- Summary of changes
- Design decisions
- Any bugs and fixes
- Testing instructions

## 8. Verification

- Confirm the app builds successfully.
- Test search, filters, and sorting individually and in combination.
- Confirm the existing workout CRUD and starred functionality still work.
- Check that no secrets or `.env` files are included in Git.

Stay on `feature/search-filter`.

Do not commit directly to `main`.

When finished, commit and push `feature/search-filter` to GitHub, but DO NOT merge the pull request.

Summarize what you built and how I should test it.
```

## Changes made — summary

- Added a live, case-insensitive title search to Workout history, with a separate
  Clear search action.
- Added activity and status filters with All activities/All statuses defaults.
  Activity IDs and names come from the existing Supabase `workout_types` table;
  statuses reuse the existing model constants.
- Added Newest first (default), Oldest first, and Longest distance first.
  Unknown distances follow all known distances, including zero.
- Combined all controls in one non-mutating filtering/sorting function. Added a
  matching-results count, friendly no-match feedback, and Clear filters actions.
- Kept the original empty-journal state, database retry behavior, workout
  links, CRUD, and star controls.
- Added responsive styles and accessible labels. Activity lookup errors disable
  only that control and include a retry; other controls remain usable.
- Updated owner-scoped workout loading to fetch additional result pages instead
  of silently searching only the first Supabase response.
- Added unit tests and extended desktop/mobile browser tests.
- No database tables, migrations, RLS policies, authentication flows, or other
  planned features were added or changed. `schema.md` is unchanged.

## Design decisions — summary

- Filtering is performed immediately over the already-authorized loaded
  workouts, so typing does not send a database request on every keystroke.
- Search is a literal title substring match, ignores case and surrounding
  whitespace, and does not interpret `%`, `_`, `*`, or backslashes as patterns.
  Notes are not searched.
- Activity, status, and search predicates are combined with AND. Sort order is
  applied after filtering. The shared workout array is never sorted in place.
- Date sorting uses the workout's calendar date rather than creation time.
  Creation time and UUID provide stable tie-breakers; equal distances use
  newest workout date first.
- Blank distance is different from zero. Null values sort last for distance,
  and actual zero-mile workouts remain visible.
- Clear search removes only text. Clear filters resets text, activity, status,
  and sorting to their original defaults.
- Control state is local to the history page and resets when leaving it. No URL,
  database schema, or persistent filter-preference feature was added.
- Existing Supabase ownership filters are applied to every result page, and
  existing RLS remains the security boundary. Loaded records are cleared on
  user/view changes using the existing resource hook.
- Compact controls use the existing warm-white, charcoal, and sage styling,
  with mobile stacking, associated labels, and clear touch actions.

## Bugs, fixes, and verification notes — summary

- An existing data-loading limitation could hide older search matches beyond
  Supabase's default response-size limit. Workout loading now retrieves pages
  with stable ordering and an RLS-scoped exact count. Tests also simulate a
  smaller server response cap to verify the offset advances by rows received.
- Browser fixtures were updated to represent result ranges and total counts;
  fixture owner checks still apply on every request.
- The initial browser run exposed test-fixture issues: its cross-origin count
  header needed `Access-Control-Expose-Headers` so the SDK could read pagination
  totals, and a simulated activity failure used a retryable HTTP status that
  delayed the assertion. The fixtures now expose the header and use a
  deterministic non-retryable failure for that error-state test. Production
  retry behavior is unchanged.
- An older regression selector matched both a Walking activity option and a
  workout's metadata after the new filter was added. It now targets the workout
  list specifically.
- Browser verification is run with traces off so generated trace HTML does not
  trigger Vite development-page reloads while testing. Failure screenshots
  remain in the ignored generated-artifacts directory.
- No user debugging follow-up prompt was supplied for this feature.

## Verification — summary

- `npm run build`: passed TypeScript checking and the Vite production build.
  Vite's existing large-bundle advisory is nonblocking.
- `npm run test:workout-filters`: all ten tests passed, covering individual and
  combined filters, all requested sort orders, null/zero distances, literal
  search characters, stable ties, all activity IDs, and immutable input.
- `npm run test:workout-validation`: all nine existing tests passed.
- `bash scripts/test-workout-database.sh`: passed the existing workout/star
  constraints, permissions, repeat-run safety, cascade, and cross-user RLS tests.
- Browser coverage includes live search, combined controls, reset actions,
  no-match feedback, sorting, private-record exclusion, activity lookup retry,
  matches beyond 1,000 records, existing CRUD, favorites, and protected routes
  on desktop and mobile.
- All 30 desktop/mobile cases passed across the final completed runs, including
  the corrected fixture cases and the existing CRUD/favorites regressions.
- Browser Auth/PostgREST requests are intercepted, and SQL tests use disposable
  local PostgreSQL. The agent has not used a real signed-in Supabase account to
  independently verify this feature; perform the manual checks below.
- Commit/push scope is only `feature/search-filter`. No switch to `main` or
  pull-request merge is authorized.

## Manual testing instructions — summary

1. Log in and open Workout history. Use several workouts with different dates,
   activities, statuses, and distances, including a blank distance and zero.
2. Search part of a title using different capitalization. Confirm results update
   while typing. Clear search and check all otherwise-matching workouts return.
3. Search `tempo`, choose Running and Completed, and confirm only completed
   running workouts with that title substring appear. Try each activity and
   status individually, including All activities and All statuses.
4. Switch among Newest first, Oldest first, and Longest distance first. Confirm
   dates determine chronological order and unknown distances follow zero.
5. Enter a title that does not exist. Confirm the no-match message and use Clear
   filters. All controls should reset, including Newest first.
6. Star a filtered workout, open its details, edit it, and verify its saved values
   after refresh. Check the Starred Workouts page. Test existing create and
   confirmed-delete behavior as well.
7. Repeat on a phone-size screen and check labels, clear buttons, selects, and
   workout links remain usable.
8. Use a second account to confirm searches cannot expose another user's
   workouts. Log out and verify workout history still redirects to login.

No new Supabase migration is required.
