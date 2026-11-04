# Stride

Stride is a responsive fitness planning and tracking web app built for an
Intro to Coding final project. It brings planned workouts, completed training,
running goals, strength sessions, and simple daily recovery check-ins into
one private training journal.

**Live app: [stride-abbystern.replit.app](https://stride-abbystern.replit.app)**

Create an account with your own email and password to try the app. Confirm
your email if requested, then sign in. No shared demo credentials are required.

## Implemented features

| Area | What users can do |
| --- | --- |
| Authentication | Sign up, confirm email, log in/out, and stay signed in across refreshes. Training pages require authentication. |
| Workout logging | Create, view, edit, and delete workouts; record activity, date, status, distance, duration, and notes. Workouts can be planned, in progress, or completed. |
| Validation | Receive helpful errors for missing fields and invalid measurements instead of saving invalid workouts. |
| Starred workouts | Star/unstar workouts and find them on a dedicated favorites page. |
| Search, filter, and sort | Find workouts by title and combine activity/status/date filters and sorting. |
| Dashboard | Review weekly and overall training statistics, completed running mileage, aggregate running pace, and weekly mileage charts. |
| Training calendar | Use week/month views, add workouts to a selected day, set optional local start times, reschedule workouts, schedule rest days, and save weekly running mileage goals. |
| Strength training | Create reusable exercise routines, attach them to workouts, track sets/reps/weights, finish sessions, and review previous performance. |
| Daily recovery | Save sleep hours and 1–5 energy/soreness ratings; update today's entry without duplicates and view dated history. |
| Data privacy | Supabase Row Level Security (RLS) restricts user-owned records to their owner. |

Running statistics exclude non-running activities. Scheduled calendar mileage
uses planned/in-progress Running workouts; completed mileage uses completed
Running workouts. Average pace uses eligible completed runs' total duration
divided by total distance. Rest days do not count toward training statistics.

**Not implemented:** nutrition logging, automatic Garmin/Oura/Strava imports,
AI recommendations, or advanced recovery analysis. The broader roadmap in
[PLAN.md](PLAN.md) includes future ideas; it is not a claim that they are all
available in this version.

## Technology stack

- **Frontend:** React, TypeScript, Vite, and React Router.
- **Styling:** Responsive CSS with Stride's cream, charcoal, and sage palette;
  Lucide icons and Recharts for dashboard charts.
- **Authentication:** Supabase Auth with persistent browser sessions.
- **Database:** Supabase PostgreSQL, SQL migrations, and owner-based RLS policies.
- **Testing:** Node's built-in test runner, local PostgreSQL security tests,
  and Playwright desktop/mobile browser tests.
- **Hosting:** Replit.

## Local setup

### Prerequisites

- Node.js **24** and npm, plus Git.
- A Supabase project you control for development.
- For database tests: local PostgreSQL tools `initdb`, `pg_ctl`, and `psql`
  on `PATH`. These are not required just to run the frontend.
- For browser tests: a working Chromium installation (details below).

### 1. Install dependencies

```sh
git clone https://github.com/abbystern/stride.git
cd stride
npm ci
```

### 2. Configure environment variables

Create a local **`.env.local`** file in the project root:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

These are placeholders, not working credentials. Obtain your project's URL
and browser-safe anon/publishable key from Supabase project settings.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | The project base URL, without `/rest/v1` or `/auth/v1`. |
| `VITE_SUPABASE_ANON_KEY` | The browser-safe anon/publishable key, used with Supabase Auth and RLS. |

These are the two required application variables. On Replit, configure them
in Secrets instead of committing an environment file. They must also be
available during the production build because Vite embeds frontend variables
at build time. Restart Vite after changing them.

**Security:** `VITE_` variables are visible to the browser. Never put a
Supabase service-role key, database password, or other privileged credential
in a `VITE_` variable. Never commit `.env`/`.env.local` files, passwords,
tokens, or real user data. Environment files are covered by `.gitignore`.

### 3. Set up Supabase

Use a separate development project rather than experimenting on a shared
production database.

1. In Supabase Auth, enable email/password sign-up.
2. In Auth URL Configuration, allow `http://localhost:5000` for local
   development. When using Replit Preview, allow that preview origin too.
   Configure the Site URL/allowed redirects for your deployment when publishing;
   this app requests email confirmation redirects to its current origin.
   The deployed origin for this project is
   `https://stride-abbystern.replit.app`.
3. Run the following files in Supabase's SQL Editor **in numbered order**:

   | Migration | Creates or configures |
   | --- | --- |
   | [001_auth_users.sql](supabase/migrations/001_auth_users.sql) | Public user profiles and the Auth sign-up trigger. |
   | [002_workout_database.sql](supabase/migrations/002_workout_database.sql) | Workout types, workouts, validation constraints, and RLS. |
   | [003_stars.sql](supabase/migrations/003_stars.sql) | Private starred-workout records. |
   | [004_training_calendar.sql](supabase/migrations/004_training_calendar.sql) | User-owned weekly mileage goals. |
   | [005_strength_tracker.sql](supabase/migrations/005_strength_tracker.sql) | Strength templates, exercises, sets, and related operations. |
   | [006_calendar_improvements.sql](supabase/migrations/006_calendar_improvements.sql) | Optional workout start times and Rest Day support. |
   | [007_recovery_checkin.sql](supabase/migrations/007_recovery_checkin.sql) | Private daily recovery entries, validation, and daily uniqueness. |

4. Keep RLS enabled. The migrations define the permissions/policies; do not
   disable them to work around an access error.
5. Create a test account through the app, confirm its email if required, and
   verify that its matching profile appears in `public.users`.

For an existing project, review which migrations are already applied before
running SQL. Migration files in Git do not prove that the remote database
has been updated. Do not edit applied migrations or run the disposable
database test fixtures against your hosted Supabase database.

See [schema.md](schema.md) for table relationships, constraints, permissions,
and migration/deployment status notes.

### 4. Start the app

```sh
npm run dev
```

Open **http://localhost:5000** or use Replit's Preview. Sign up, confirm your
email if required, and log in.

To compile and preview the production bundle locally, first stop the
development server to free port 5000:

```sh
npm run build
npm run preview
```

`preview` is for checking the compiled bundle locally, not a production-hosting
recommendation.

## Automated tests

### Required assignment tests

```sh
npm run test:required
```

This runs:

1. **User data isolation:** A can read their workout; B cannot read, update,
   or delete it; A's full original record remains unchanged.
2. **Dashboard mileage:** Completed runs of 4 + 5 + 6 miles total **15**;
   a planned 8-mile run and completed non-running activities are excluded.
   The test uses the dashboard's real calculation function.

Run them individually:

```sh
npm run test:data-isolation
npm run test:required-dashboard
```

The isolation test requires local PostgreSQL tools and creates a disposable
socket-only database with synthetic users. It applies real workout RLS
policies but emulates Supabase identity claims, rather than testing hosted
Auth/JWT verification. It uses no hosted credentials or real user records.

### Additional checks

```sh
# All pure unit/calculation/validation tests
node --experimental-strip-types --test tests/*.test.ts

# Full disposable local database suite, including migrations 001–007 and RLS
bash scripts/test-workout-database.sh

# Compilation and production bundle
npm run build
```

For browser tests, keep `npm run dev` running in one terminal, then run this
in another:

```sh
npm run test:workout-ui
```

Playwright exercises desktop and mobile layouts using synthetic Auth/API
fixtures; these mocks are not evidence of hosted database security. The
separate local PostgreSQL tests exercise real database policies.

On a standard local machine, install the browser if needed:

```sh
npx playwright install chromium
```

The test config uses `/repl/tools/bin/chromium` automatically when present.
An optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` variable can point to another
working Chromium executable. Linux machines may also need Chromium's system
libraries; do not assume a downloaded browser works unchanged on Replit/Nix.
Bulk browser output goes to the ignored `generated-artifacts/` directory.

### Red/green evidence

[Testing evidence and reproduction instructions](docs/test-evidence/README.md)
explain the safe, intentional failing demonstrations and restored passing
runs. All four PNGs are included, along with actual-output transcripts:

| Test | Failing evidence | Passing evidence |
| --- | --- | --- |
| User data isolation | [data-isolation-fail.png](docs/test-evidence/data-isolation-fail.png) | [data-isolation-pass.png](docs/test-evidence/data-isolation-pass.png) |
| Dashboard mileage | [dashboard-fail.png](docs/test-evidence/dashboard-fail.png) | [dashboard-pass.png](docs/test-evidence/dashboard-pass.png) |

The screenshots capture real test output in a read-only log viewer, not a
native terminal window. Intentional defects affect only disposable test
resources; they do not weaken production policies or modify the production
calculation. See the evidence guide for direct terminal commands.

## Assignment review guide

Start with the [project plan and requirements](PLAN.md), then review the
[database schema](schema.md), [development prompt logs](prompts/), and
[automated test evidence](docs/test-evidence/README.md).

| Requirement/implementation area | Development record |
| --- | --- |
| Initial planning | [Initial plan](prompts/initial-plan.md) |
| Authentication | [Authentication](prompts/authentication.md) |
| Workout database | [Database implementation](prompts/workout-database.md) |
| Workout CRUD and input validation | [Workout logging](prompts/workout-logging.md) |
| Favorites | [Stars](prompts/stars.md) |
| Search, filter, and sort | [Search/filter](prompts/search-filter.md) |
| Dashboard calculations and debugging | [Dashboard](prompts/dashboard.md) |
| Custom training calendar and usability improvements | [Training calendar](prompts/training-calendar.md), [calendar improvements](prompts/calendar-improvements.md) |
| Custom strength tracker | [Strength training](prompts/strength-tracker.md) |
| Custom simple recovery check-in | [Recovery](prompts/recovery-checkin.md) |
| Required automated tests and red/green demonstrations | [Automated tests](prompts/automated-tests.md) |

Prompt logs distinguish original prompts from implementation summaries and
record debugging, setup, and testing. Future scope in the plan is separate
from the implemented feature summary above.
