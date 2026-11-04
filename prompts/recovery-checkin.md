# Feature 10: Simple Daily Recovery Check-In

## Original prompt — verbatim

```text
I'm implementing Feature 10: Simple Daily Recovery Check-In for Stride. This is my third custom feature for my Intro to Coding assignment.

Read `PLAN.md`, `schema.md`, and the existing application code before making changes.

Work only on branch `feature/recovery-checkin`. Do not modify unrelated features.

IMPORTANT: Keep this feature extremely simple. I need a working recovery check-in, not a comprehensive recovery platform.

## 1. Recovery Page

Add a "Recovery" page to the main navigation.

Create a simple daily check-in form with only three fields:

- **Sleep:** Number of hours slept (allow decimals, e.g., 7.5)
- **Energy:** Rating from 1 to 5
- **Soreness:** Rating from 1 to 5

Automatically use today's date for the entry.

Users should be able to click "Save Check-In" and receive confirmation that their entry was saved.

## 2. Recovery History

Below the form, display previous recovery entries in a simple list, with the date, sleep hours, energy rating, and soreness rating.

If a user has already submitted a check-in for today, load the existing values into the form and allow them to update it instead of creating a duplicate.

No graphs, charts, trends, or advanced analysis.

## 3. Database

Create a `recovery_entries` table in Supabase with:

- `id` — UUID primary key
- `user_id` — UUID foreign key associated with the authenticated user
- `date` — date
- `sleep_hours` — numeric
- `energy_rating` — integer
- `soreness_rating` — integer
- `created_at` — timestamp

Add a unique constraint on `(user_id, date)` so users can have only one entry per day.

Enable Row Level Security and implement policies so users can only create, read, and update their own recovery entries.

Create a NEW numbered SQL migration in `supabase/migrations/`. Do not edit migrations that have already been applied.

## 4. Validation

- Sleep must be between 0 and 24 hours.
- Energy must be between 1 and 5.
- Soreness must be between 1 and 5.
- All three values are required.
- Show helpful validation messages for missing or invalid information.

## 5. Design

Follow Stride's existing warm white, charcoal, and sage design.

Keep the form clean, minimal, and mobile-friendly.

Do not redesign the rest of the app.

## 6. Documentation

Create `prompts/recovery-checkin.md` documenting:
- This original prompt
- Implementation decisions
- Any debugging or fixes
- Manual testing instructions and results

Update `schema.md` with the new table and relationship.

## 7. Verification

Run the production build and check for errors.

Explain how I can test:
1. Creating a recovery check-in.
2. Refreshing and seeing saved data.
3. Updating today's entry.
4. Viewing previous entries.
5. Rejecting invalid values.

Ensure another user cannot access these records.

Do not implement nutrition tracking, Garmin, Oura, Strava, or unrelated features.

Do not commit directly to main.

When finished, commit and push only `feature/recovery-checkin` to GitHub. Do not merge the PR.

Tell me exactly which SQL migration I need to run in Supabase before testing.
```

## Implementation decisions — summary

- Protected `/app/recovery`, linked from both the Home page's navigation
  actions and the shared workout navigation. Existing pages are not redesigned.
- Exactly three editable fields: decimal sleep hours and 1–5 energy/soreness
  selectors. Required/range/integer validation runs before any save request;
  SQL constraints enforce required values and ranges independently.
- Automatically use the browser's local date, not UTC. Date refreshes on
  focus/visibility changes and every minute; a stale-day save is rejected
  rather than quietly saving against yesterday.
- Load today's saved values only after successful history loading. Upsert on
  `(user_id, date)` atomically updates today without duplicates; retain ID and
  `created_at`. Zero hours is a valid value, not a missing field.
- Newest-first history includes today's saved entry. No historical date
  picker, delete button, notes, graphs, scores, integrations, or nutrition.
- API queries filter by authenticated owner. New table RLS permits only own
  SELECT/INSERT/UPDATE, including ownership checks on both sides of UPDATE.
  No anonymous or authenticated DELETE grant; existing table policies stay intact.
- Loading/errors/retry are explicit. Failed loads are never treated as an
  empty history; failed saves retain values and never report success.
- New queries are isolated to Recovery so an unapplied migration does not
  break existing workouts, strength, dashboards, or calendar routes.

## Database setup

Run **`supabase/migrations/007_recovery_checkin.sql`** in the existing
Supabase project's SQL Editor before testing. It requires `public.users`
from migration 001 and does not modify migrations 001–006. It creates the
table/constraints/owner-only policies and refreshes the PostgREST schema cache.
Refresh Recovery afterward, or click Retry.

This SQL has been tested in a disposable local PostgreSQL database. Remote
application is manual and is not claimed by repository tests.

## Debugging and fixes — summary, not quotations

- Review found an asynchronous error-state capture that could obscure the
  current save failure. The page now formats the actual caught error directly
  rather than reading a stale hook error from before the request.
- Initial browser checks found that Home has separate navigation rather than
  the shared workout header. Added the missing Home Recovery link as well as
  the shared navigation link; retained the navigation test to cover both.
- Browser clocks intentionally use a local date different from UTC and a time
  before synthetic token expiry. No live account data or credentials are used.

## Verification and manual testing

Automated commands:

```sh
npm run build
node --experimental-strip-types --test tests/*.test.ts
bash scripts/test-workout-database.sh
npx playwright test tests/browser/recovery.spec.ts --trace off
```

Local results are recorded after the final verification below. Browser tests
use synthetic Supabase responses, while database security/constraints are
tested against real disposable PostgreSQL roles. No signed-in live-account
manual results are claimed.

### Verified results — November 4, 2026

- Production build passed; only the existing Vite large-chunk advisory remains.
- All **61** unit tests passed, including five new recovery validation tests.
- The complete local PostgreSQL suite through migration 007 passed: daily
  uniqueness/upsert, required/range constraints, owner-only reads/writes,
  ownership-transfer/spoofing rejection, anonymous denial, no DELETE grant,
  migration repeatability, and profile-deletion cascade.
- All **eight** new desktop/mobile browser cases were verified: six passed
  initially, and the two Home-navigation/create/update cases passed after the
  missing Home link was fixed.
- Browser coverage includes local-date creation, refresh/prefill, update
  without a duplicate, zero hours, prior history, missing/range validation,
  permission failures without lost drafts or false confirmation, missing
  migration/retry, logged-out protection, and mobile overflow.
- Public preview correctly requires sign-in. Signed-in desktop/mobile
  screenshots were produced from synthetic browser tests, not a live account.

### Manual checks after applying migration 007

1. Log in and open **Recovery** from Home or the main navigation. A user with
   no entry today sees a blank form and today's local date.
2. Save sleep **7.5**, energy **4**, soreness **2**. Expect **Check-in saved.**
   and a history row showing today's date and all three values.
3. Refresh. All three values must prefill; today appears only once in history.
4. Change sleep to **8**, save using **Update Check-In**, and refresh again.
   Expect the updated value and only one `(user_id, date)` row in Supabase,
   with the same ID and creation timestamp.
5. Existing previous-day entries appear below the form newest first. If there
   are none, check again on another day; this simple UI does not backdate entries.
6. Submit missing fields; try sleep **-1** or **24.1**. Expect helpful messages
   and no saved row. Sleep **0** and **24** are valid. Ratings allow only 1–5;
   unit/SQL tests separately cover invalid and fractional ratings.
7. Log out; `/app/recovery` must require sign-in. Log in as a second user;
   history and the form must not reveal the first user's check-ins.
8. Optional ownership verification through an authenticated API client:
   attempts to SELECT another user's row return no data, and INSERT/UPDATE
   ownership spoofing is denied. Never disable RLS or expose a service key.
