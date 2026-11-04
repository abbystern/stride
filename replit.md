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

Weekly planning, lifting templates, nutrition, and recovery are intentionally not included.
