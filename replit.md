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

Dashboards, weekly planning, lifting templates, nutrition, and recovery are intentionally not included.
