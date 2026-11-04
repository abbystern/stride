# Feature 5: Starred Workouts

## Implementation prompt — verbatim

The user supplied this prompt as an attachment:

```text
I'm continuing development of Stride, my fitness training web app.

Read `PLAN.md`, `schema.md`, and the existing workout logging code before making changes.

We are implementing **Feature 5: Starred Workouts**.

Current Git branch: `feature/stars`.

IMPORTANT: Implement only the favorites functionality. Do not add unrelated features.

## 1. Create the stars database table

Create a Supabase SQL migration:

`supabase/migrations/003_stars.sql`

The table must contain:
- `id`: UUID, primary key
- `user_id`: UUID, references `public.users.id`
- `workout_id`: UUID, references `public.workouts.id`

Add a unique constraint on `(user_id, workout_id)` so users cannot star the same workout twice.

The stars table must be shared across all users, not one table per user.

## 2. Database security

Implement Row Level Security so that:
- Users can view only their own stars.
- Users can add and remove only their own stars.
- Users can only star workouts they own.
- Users cannot access another user's private workouts through the stars table.

Do not disable existing security policies.

## 3. Star and unstar workouts

- Add a clickable star icon to workout cards and individual workout pages.
- Clicking an unfilled star saves the workout as a favorite.
- Clicking a filled star removes it from favorites.
- Starred status persists after refreshing the page.
- Show useful error messages if an operation fails.

## 4. Starred Workouts page

Create a dedicated view where users can see only their starred workouts.

Each workout should be clickable so users can open its details.

Include a friendly empty state when no workouts have been starred.

## 5. Design

Follow the existing Stride design:
- Warm white background
- Charcoal text
- Muted sage green accents
- Minimal and mobile-friendly interface

Use a subtle filled star to distinguish favorites.

## 6. Documentation

Create `prompts/stars.md` with the implementation prompt, summary of changes, decisions, and any debugging prompts.

Update `schema.md` to include the stars junction table and its relationships.

## 7. Verification

- Confirm the app builds.
- Explain how to apply the SQL migration in Supabase.
- Explain how to test starring, unstarring, persistence, and the favorites view.
- Confirm no credentials or `.env` files will be committed.

Stay on `feature/stars`.

Do not commit directly to `main` or push anything yet.
```

## Changes made — summary

- Added `supabase/migrations/003_stars.sql`, creating one shared favorites table
  with the requested UUID fields, foreign keys, unique user/workout pair, an
  index, explicit grants, and three RLS policies.
- Added Supabase favorites helpers and a shared authenticated `StarsProvider`
  so history, details, and the favorites page use the same saved star state.
- Added an accessible `StarButton` on history/favorite cards and detail pages:
  an outlined icon is unstarred; a subtle sage-filled icon is starred.
- Added the protected `/app/stars` page with only favorite workouts, clickable
  details, a friendly empty state, and loading/error/retry states.
- Added home and workout navigation links, while keeping the existing
  authentication, CRUD, validation, and design.
- Updated `schema.md` with the junction table, relationships, RLS, cascading
  deletion, and manual migration instructions.
- Extended local SQL security tests and desktop/mobile API-contract browser
  tests. No unrelated planned feature was implemented.

## Decisions — summary

- RLS checks both the star's owner and the referenced workout's owner on insert
  and select. Workouts retain their existing RLS. No security-definer function,
  client service key, or authentication bypass is introduced.
- Authenticated clients have only SELECT, INSERT, and DELETE on stars, not
  UPDATE. Favorites cannot be transferred by editing the junction row.
- The unique pair prevents duplicates. Idempotent insert uses
  `ON CONFLICT DO NOTHING`, not a conflict update that would require more grants.
- Foreign keys cascade when a workout/profile is deleted, preventing orphaned
  favorites. Existing migrations and policies are not weakened.
- Favorite IDs and workouts are fetched separately with ownership filters.
  The favorites page filters already-authorized workouts; it never fetches a
  different user's workout through a favorite.
- State changes only after a successful database response. Pending buttons
  prevent repeated clicks, and an in-memory request lock prevents duplicate
  writes before a React render. Failed operations preserve the last saved state.
- Account changes and obsolete requests cannot show another user's cached
  favorite state. A missing migration shows an actionable error rather than a
  false empty state or silent local-only storage.
- Star buttons are siblings of the workout links, not nested interactive
  elements; labels, `aria-pressed`, field-level error feedback, and 44px touch
  targets support keyboard and mobile use.

## Debugging prompts and fixes — summary

No additional user debugging prompt was supplied for this feature. Existing
browser fixtures were extended to intercept the new stars requests so regression
tests continue to run without contacting remote Supabase. Test fixtures contain
synthetic, nonfunctional values, not real account credentials.

The initial browser run found that the history-page favorites error banner
replaced a specific missing-migration message with generic text. The banner now
shows the actual friendly error, including the `003_stars.sql` setup instruction,
while keeping the existing workout journal usable.

## Verification and limitations — summary

- The production build and existing validation tests passed.
- All nine validation tests and all 22 desktop/mobile browser cases passed
  across the final completed runs (20 initial passes plus the two corrected
  missing-migration cases).
- Local SQL tests passed for duplicate prevention, authenticated own-star
  operations, forged ownership, cross-user reads/deletes/joins, anonymous denial,
  blocked UPDATE, migration reruns, and cascading workout/profile deletion.
- Browser tests exercise filled/unfilled controls, shared state, refresh
  persistence, favorites-only lists, empty states, errors/retries, repeated
  clicks, deleted workouts, mobile layout, and protected routes.
- Browser Auth/PostgREST requests are intercepted. These tests do not prove
  that migration 003 has been applied to the real Supabase project.
- The agent has not applied the remote migration or used a real signed-in
  account to verify live favorites. Complete the manual checks below.
- No commit or push was requested or performed for this feature. Environment
  files and generated browser output remain ignored; no real passwords or
  Supabase keys belong in the changes.

## Apply the migration and manually test — summary

1. In the intended Supabase project, confirm migrations 001 and 002 are already
   applied, then review and run all of `supabase/migrations/003_stars.sql` in
   **SQL Editor → New query**. Do not disable RLS if anything fails.
2. Confirm `public.stars` has its unique pair, two foreign keys, RLS enabled,
   and SELECT/INSERT/DELETE policies. See `schema.md` for verification queries.
3. Log into Stride, open Workout history, and star a workout. Confirm the icon
   fills without opening the workout, then refresh and check it stays filled.
4. Open that workout's details. Confirm the same state, unstar it, refresh,
   then star it again.
5. Open **Starred Workouts**. Confirm only favorites appear and their links open
   details. Unstar one here; it should disappear after success. Remove the last
   favorite and confirm the empty state appears.
6. Delete a starred workout using the existing confirmation. Verify it no longer
   appears in history/favorites and its junction row is removed in Supabase.
7. Use two separate accounts. Each should see only its own workouts and stars.
   Authenticated requests must reject starring another user's known workout
   UUID or inserting a star with a forged `user_id`; anonymous access must fail.
8. If a save fails, confirm useful feedback appears and the previous filled
   state is retained. Restore the connection and retry. Log out and verify that
   `/app/stars` redirects to login.
