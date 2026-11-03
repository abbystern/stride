# Stride on Replit

## Run the app

- The app uses React + Vite and starts with `npm run dev` on port 5000.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Replit Secrets.
- Run `supabase/migrations/001_auth_users.sql` once in the Supabase SQL Editor to create the private user-profile table and signup trigger.
- In Supabase Authentication → URL Configuration, allow the app's Replit preview origin as a redirect URL so email confirmation can return to Stride.
- Build for production with `npm run build`.

This version implements Feature 1 (user authentication) only. Workout, nutrition, recovery, and dashboard features are intentionally not included.
