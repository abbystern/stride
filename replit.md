# Stride on Replit

## Run the app

- The app uses React + Vite and starts with `npm run dev` on port 5000.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Replit Secrets.
- Use the Supabase project's base URL for `VITE_SUPABASE_URL`, without `/rest/v1` or `/auth/v1`. Recognized API suffixes are normalized by the client, with a development warning.
- Run `supabase/migrations/001_auth_users.sql` once in the Supabase SQL Editor to create the private user-profile table and signup trigger.
- In Supabase Authentication → URL Configuration, allow the app's Replit preview origin as a redirect URL so email confirmation can return to Stride.
- Build for production with `npm run build`.

## Workout database

- Feature 2 adds `supabase/migrations/002_workout_database.sql` for eight shared activity types and private workouts.
- Review and run it manually in Supabase SQL Editor after the authentication migration. Do not assume the remote database has been migrated.
- See `schema.md` for the schema, RLS rules, and application/verification steps.
- Run `bash scripts/test-workout-database.sh` to test both migrations in a disposable local PostgreSQL database, not Supabase.

## Workout logging

- Feature 3 adds authenticated workout history, create, detail, and edit pages under `/app/workouts`, plus confirmed deletion.
- These pages use the existing Supabase tables and RLS; there is no new migration.
- Run `npm run test:workout-validation` for pure field-validation tests.
- Run `npm run test:workout-ui` while the dev server is running for desktop/mobile API-contract browser tests. They intercept Supabase requests and do not modify real accounts or workouts.
- Browser tests use Replit's Chromium when available; elsewhere install Playwright Chromium or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
- Browser output and caches are excluded from Git and publishing.

## Starred workouts

- Feature 5 adds star/unstar controls to workout lists/details and the protected
  `/app/stars` view, using one shared stars junction table.
- Review and manually run `supabase/migrations/003_stars.sql` in Supabase after
  migrations 001 and 002. Repository files do not mean the remote migration ran.
- Missing favorites storage displays an error/retry while existing workout
  logging remains available. See `schema.md` and `prompts/stars.md`.
- `bash scripts/test-workout-database.sh` now also tests stars ownership, unique
  pairs, anonymous denial, unchanged workout policies, and cascading deletion.
- Browser tests remain intercepted API-contract tests, not live Supabase tests.

## Search, filter, and sort

- Feature 6 adds live title search, activity/status filters, and three sort
  orders to workout history. Clear search affects only text; Clear filters also
  resets both selects and the default newest-first order.
- Filtering uses the authenticated user's loaded workouts. Data loads in
  owner-scoped pages to include records beyond Supabase's response-size limit.
- No new database migration or RLS changes are needed.
- Run `npm run test:workout-filters` for filtering/sorting unit tests.
- Browser verification can use `npm run test:workout-ui -- --trace off` to avoid
  Vite reloads from generated trace HTML.
- See `prompts/search-filter.md` for the original prompt and manual checks.

## Training dashboard

- Feature 7 is available at `/app/dashboard` via home actions and main navigation.
- This week and Overall sections show matching metrics for the local calendar
  week and all dates respectively; the chart remains a six-week view.
- The simple `/app/calendar` uses existing workout dates and per-Monday weekly
  goals; run migration 004 in Supabase before saving goals. Scheduled running
  mileage is planned/in-progress only, completed running mileage is separate.
- The calendar's first version intentionally excludes drag-and-drop, AI
  recommendations, Garmin imports, and complex scheduling; PLAN.md describes a
  broader future planner, not the scope of this first version.
- `calculateDashboard` is independent of Supabase and uses local Monday–Sunday
  calendar weeks. All three cards cover the current week; the Recharts view
  includes that week and the five preceding weeks.
- Only completed Running contributes mileage/pace. Pace uses total valid
  duration divided by total matched distance; completed-workout counts include
  all activities. Unknown pace displays an em dash, not zero.
- The dashboard reuses owner-scoped workout loading with unchanged RLS. It
  refreshes on mount/reload, successful local mutations, focus/visibility return,
  a Refresh button, and once per minute while visible.
- Run `npm run test:dashboard`; see `prompts/dashboard.md` for the focused
  required test, genuine failing/passing screenshot instructions, and manual
  checks. No new database migration is required.

## Strength tracker

- `/app/strength` manages routines; `/app/workouts/:id/strength` logs or reviews
  sets on existing workout records. Apply migration 005 manually in Supabase.
- Sessions snapshot targets. Explicit Save progress persists weights/reps and
  completion; Finish saves and completes atomically, allowing unfinished sets
  to remain uncompleted. Previous performance uses earlier completed sessions.
- All four strength tables are private. Child policies and composite FKs check
  parent ownership; RPCs remain SECURITY INVOKER. Never bypass RLS in the client.
- Existing migrations are immutable. See `schema.md` and
  `prompts/strength-tracker.md` for migration and testing instructions.

Nutrition, recovery, external wearable imports, automatic recommendations,
and advanced progression charts remain intentionally excluded.

## Calendar usability improvements

- Apply migration 006 manually after 001–005. Dates and optional local
  wall-clock times are stored separately; never convert planning times to UTC.
- Calendar defaults to Monday–Sunday, adds a month view, and uses readable
  stacked date cells on mobile. Mileage goals/totals always refer to the
  selected Monday week, including in month mode.
- Rest Day uses the existing workouts CRUD and owner-only RLS, not a separate
  schedule. Rest days have no training metrics or strength template and never
  contribute to completed-workout statistics, mileage, or pace.
- See `prompts/calendar-improvements.md` for the original prompt, usability
  motivation, implementation decisions, verification, and manual checks.
