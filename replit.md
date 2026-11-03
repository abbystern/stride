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

The UI still implements authentication only. Workout logging forms, dashboards, nutrition, and recovery features are intentionally not included.
