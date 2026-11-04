# Stride database schema

## Implementation and deployment status

| Component | Repository status | Supabase status |
| --- | --- | --- |
| Supabase-managed `auth.users` | Managed by Supabase Auth | Existing authentication is working, as confirmed by the user |
| `public.users` | Defined in `001_auth_users.sql` | User previously applied the migration and verified a profile |
| `public.workout_types` | Defined and locally tested in `002_workout_database.sql` | Available in the user's successful Feature 3 manual tests |
| `public.workouts` | Defined and locally tested in `002_workout_database.sql` | User confirmed real CRUD and persistence in Feature 3 |
| `public.stars` | Defined in `003_stars.sql`, with local security tests | User confirmed Feature 5 is working; remote schema not independently inspected |
| `public.weekly_goals` | Defined and locally tested in `004_training_calendar.sql` | Run this migration manually in Supabase; remote application is not verified |
| Strength templates, exercises, template exercises, workout sets | Defined and locally tested in `005_strength_tracker.sql` | Apply migration 005 manually; remote application has not been verified |
| Workout local start times and Rest Day activity | Defined and locally tested in `006_calendar_improvements.sql` | Apply migration 006 manually after 001–005 |
| `public.recovery_entries` | Defined and locally tested in `007_recovery_checkin.sql` | Run migration 007 manually in Supabase; remote application is not verified |

Authentication and workout logging/validation are implemented. Feature 5 adds
private favorites and a Starred Workouts page. The dashboard and training
calendar are also implemented; wearable integrations remain out of scope.
Repository files do not prove a migration was applied remotely. The agent has
not applied migration 004 to the remote Supabase project.

## 1. User identities and profiles

Supabase owns `auth.users` and manages credentials and authentication sessions. Stride does not store passwords in its public application tables.

### `public.users`

Source: `supabase/migrations/001_auth_users.sql`.

| Column | PostgreSQL type | Required/default | Keys and constraints |
| --- | --- | --- | --- |
| `id` | `uuid` | Required; supplied by the signup trigger | Primary key; FK to `auth.users.id`, `ON DELETE CASCADE` |
| `email` | `text` | Required | Unique |
| `created_at` | `timestamptz` | Required; `now()` | Creation timestamp |

The `on_auth_user_created` trigger calls `public.handle_new_user()` after an Auth user is inserted. Its `SECURITY DEFINER` function has an empty search path and writes to the fully qualified `public.users` table.

**RLS:** Enabled. Authenticated users may select only the row where `auth.uid() = id`. Anonymous access is revoked. No client insert, update, or delete policies are supplied by this migration; profile creation is handled by the trigger.

## 2. Shared activity types

### `public.workout_types`

Source: `supabase/migrations/002_workout_database.sql`.

| Column | PostgreSQL type | Required/default | Keys and constraints |
| --- | --- | --- | --- |
| `id` | `uuid` | Required; `gen_random_uuid()` | Primary key |
| `name` | `text` | Required | Unique; must contain a non-whitespace character |

Seeded names:

1. Running
2. Strength Training
3. Cycling
4. Pilates
5. Physical Therapy
6. Walking
7. Hiking
8. Other
9. Rest Day (added by migration 006)

**Permissions and RLS:** Authenticated users can read all types. Anonymous users have no access. Clients cannot insert, edit, or delete types. The read policy applies only to the `authenticated` role.

Seed inserts use `ON CONFLICT (name) DO NOTHING`. Rerunning the migration does not replace existing type UUIDs or labels and does not delete additional types.

## 3. Private workouts

### `public.workouts`

Source: `supabase/migrations/002_workout_database.sql`.

| Column | PostgreSQL type | Required/default | Keys and constraints |
| --- | --- | --- | --- |
| `id` | `uuid` | Required; `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | Required; `auth.uid()` | FK to `public.users.id`, `ON DELETE CASCADE` |
| `workout_type_id` | `uuid` | Required | FK to `public.workout_types.id`, `ON DELETE RESTRICT` |
| `template_id` | `uuid` | Optional; migration 005 | Composite owner-matching FK to `workout_templates(id, user_id)` |
| `date` | `date` | Required; `current_date` | Workout's planned or actual calendar date |
| `scheduled_start_time` | `time without time zone` | Optional; null; migration 006 | Local wall-clock time, 00:00–23:59, with seconds exactly zero |
| `title` | `text` | Required | Must contain a non-whitespace character |
| `status` | `text` | Required; `'planned'` | Exactly `planned`, `in_progress`, or `completed` |
| `run_type` | `text` | Optional; null | Descriptive running subtype |
| `distance_miles` | `numeric` | Optional; null | Nonnegative and finite |
| `duration_minutes` | `numeric` | Optional; null | Nonnegative and finite |
| `target_pace` | `text` | Optional; null | Target pace or pace range |
| `elevation_feet` | `numeric` | Optional; null | Nonnegative, finite elevation **gain**, not signed altitude |
| `notes` | `text` | Optional; null | Free-form notes |
| `created_at` | `timestamptz` | Required; `now()` | Timezone-aware creation timestamp |

Zero is valid for optional numeric measurements. Null means unknown or not applicable. Negative numbers, `NaN`, and positive/negative infinity are rejected. Numeric precision is not prematurely restricted, preserving decimal measurements from future activity imports.

Suggested `run_type` descriptions are easy/base, recovery, long run, tempo/threshold, VO2 max, and sprints/strides. This optional text is deliberately not an enum so future provider labels can be mapped or preserved without changing the database type.

Indexes:

- `workouts_user_date_idx`: `(user_id, date DESC)` for ownership checks and dated workout retrieval.
- `workouts_type_idx`: `(workout_type_id)` for activity joins and foreign-key lookup.

### Activity-specific interpretation

| Type | Data supported now |
| --- | --- |
| Running | Date, status, distance, duration, target pace, elevation gain, run type, notes |
| Walking / Hiking | Separate activity types; optional distance, duration, elevation gain, notes |
| Strength Training | Existing workout record with optional template, captured exercise targets, actual set weights/reps, completion, and prior-performance comparison |
| Cycling | Date, duration, status, notes, and optional distance |
| Pilates / Physical Therapy / Other | Date, duration, status, notes |
| Rest Day | Date, optional local start time, title, status, notes; no training metrics or strength template |

Activity measurements remain nullable. A planned session need not already have actual results. The database does not reject a metric merely because a future imported activity uses it with a different type.

**Actual weekly running mileage:** Future queries must include only `Running` workouts with `status = 'completed'` within the requested week. Walking, hiking, cycling, and planned or in-progress runs must not contribute. There is no mileage dashboard or stored aggregate in this feature.

Example for a signed-in user's current week (Monday start):

```sql
select coalesce(sum(w.distance_miles), 0) as completed_running_miles
from public.workouts w
join public.workout_types t on t.id = w.workout_type_id
where w.user_id = auth.uid()
  and t.name = 'Running'
  and w.status = 'completed'
  and w.date >= date_trunc('week', current_date)::date
  and w.date < (date_trunc('week', current_date) + interval '1 week')::date;
```

This is a documented query rule for later features, not new application functionality. Later interfaces should supply dates explicitly for the user's calendar/timezone rather than relying on server defaults.

### Workouts: permissions and RLS

Anonymous access is revoked, including inherited `PUBLIC` table privileges. Authenticated clients receive only `SELECT`, `INSERT`, `UPDATE`, and `DELETE`, not `TRUNCATE` or schema-management privileges.

| Operation | Policy | Database condition |
| --- | --- | --- |
| Select | `workouts_select_own` | `USING (auth.uid() = user_id)` |
| Insert | `workouts_insert_own` | `WITH CHECK (auth.uid() = user_id)` |
| Update | `workouts_update_own` | Both `USING` and `WITH CHECK` require `auth.uid() = user_id` |
| Delete | `workouts_delete_own` | `USING (auth.uid() = user_id)` |

An update must satisfy ownership both before and after the change, so a user cannot transfer a workout to another user. Reading, updating, or deleting someone else's known workout UUID affects zero visible rows. Forging another owner's UUID on insert or ownership transfer is rejected by RLS. Frontend filters are not the security boundary.

Supabase database owners and service roles can bypass RLS. Do not use private service-role keys in the browser, and do not treat an unrestricted SQL Editor query as a user-isolation test.

## 4. Private starred workouts

### `public.stars`

Source: `supabase/migrations/003_stars.sql`.

This is one shared junction table, not a separate table per user.

| Column | PostgreSQL type | Required/default | Keys and constraints |
| --- | --- | --- | --- |
| `id` | `uuid` | Required; `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | Required; `auth.uid()` | FK to `public.users.id`, `ON DELETE CASCADE` |
| `workout_id` | `uuid` | Required | FK to `public.workouts.id`, `ON DELETE CASCADE` |

- `stars_user_workout_key`: unique `(user_id, workout_id)`, preventing duplicate
  favorites and providing an owner-prefixed index.
- `stars_workout_idx`: `(workout_id)`, supporting foreign-key deletion lookup.
- Existing users, workouts, and workout policies are unchanged.

### Stars: permissions and RLS

RLS is enabled. All `PUBLIC`, `anon`, and prior `authenticated` table grants are
revoked, then authenticated clients receive only `SELECT`, `INSERT`, and
`DELETE`. They receive no `UPDATE` grant or policy, so a favorite cannot be
reassigned to another owner or workout.

| Operation | Policy | Database condition |
| --- | --- | --- |
| Select | `stars_select_own` | `user_id = auth.uid()` and referenced workout belongs to that same user |
| Insert | `stars_insert_own_workout` | Same ownership conditions in `WITH CHECK` |
| Delete | `stars_delete_own` | `user_id = auth.uid()` |

The workout ownership check uses an `EXISTS` query against `public.workouts`
under its existing RLS. A known private workout UUID cannot be starred by
another user, and joining through stars cannot reveal private workouts. The
select check also hides an inconsistent cross-owner reference inserted by an
administrator that bypasses RLS. Database owners/service roles can still bypass
RLS; never use service-role credentials in the browser.

The app loads only the signed-in user's stars and separately owner-filtered
workouts. Star creation uses `ON CONFLICT DO NOTHING` for the unique user/workout
pair, so repeated requests are idempotent and do not require `UPDATE` permission.
Unstarring deletes only the matching user's workout reference.

## 5. Relationships and deletion behavior

```text
auth.users       1 ── 1 public.users
public.users     1 ── * public.workouts
workout_types    1 ── * public.workouts
public.users     1 ── * public.stars
public.workouts  1 ── * public.stars
```

- Each workout belongs to one existing public user profile and one existing activity type.
- Deleting an Auth user cascades to the public profile; deleting a profile cascades to its workouts. No accounts or records are deleted by migration 002.
- An activity type referenced by a workout cannot be deleted, avoiding orphaned workouts.
- Deleting a workout removes its stars automatically. Deleting a profile removes
  its stars as well as its workouts. Migration 003 itself deletes no records.
- Workout UUIDs are generated independently of external activity IDs. Garmin imports, provider identifiers, deduplication, and import jobs remain future work; none are implemented here.

## 6. Applying migration 002 manually

1. Confirm you are viewing the intended Supabase project and that `public.users` from migration 001 already exists. Apply 001 first only if the authentication schema has not been installed.
2. Review `supabase/migrations/002_workout_database.sql`.
3. Open **Supabase SQL Editor → New query**, paste the entire migration, and run it.
4. The explicit transaction commits tables, seeds, grants, and policies together. If it fails, resolve the reported issue and rerun the migration; do not disable RLS.
5. Verify the tables, activity names, constraints, and policies as below.

Migration 002 is safe to rerun against its own schema: it retains existing workout records and type IDs, skips existing tables/indexes, and recreates only its named policies. It does not silently repair an unrelated or incompatible pre-existing schema; such a conflict should be reviewed and handled with an explicit later migration.

### Verify structure and reference data

```sql
select name from public.workout_types order by name;
-- On a fresh installation: the eight names listed above.

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('workout_types', 'workouts')
order by table_name, ordinal_position;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('workout_types', 'workouts');
-- Both rows must show rls_enabled = true.

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('workout_types', 'workouts')
order by tablename, policyname;
-- One authenticated read policy for types; four owner policies for workouts.
```

### Verify real-user isolation

Use two test accounts with public profiles and a workout owned by User B. Substitute real UUIDs into the following **rollback-only** transaction:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_A_UUID>', true);

select id, user_id, title
from public.workouts
where id = '<WORKOUT_B_UUID>';
-- Expected: zero rows.

update public.workouts set title = 'Isolation check'
where id = '<WORKOUT_B_UUID>' returning id;
-- Expected: zero rows.

delete from public.workouts
where id = '<WORKOUT_B_UUID>' returning id;
-- Expected: zero rows.

rollback;
```

Also verify with authenticated Supabase requests that each user can insert, read, edit, and delete their own test workout; cannot create a workout for another UUID; cannot change `user_id` to another owner; and can read but not edit workout types. Use separate rollback-only transactions for expected SQL errors, since an error aborts the transaction. Never copy private credentials into the repository.

### Automated local verification

```sh
bash scripts/test-workout-database.sh
npm run build
```

The test script creates a disposable local PostgreSQL cluster with no TCP listener, synthetic identities, and a minimal `auth.uid()` stand-in. It applies 001, applies 002 twice, and verifies defaults, all eight seeds, data preservation, constraints, permissions, CRUD ownership, and two-user RLS isolation. It also checks the future completed-running-only mileage filter. The cluster is removed afterward.

**Do not run `supabase/tests/002_workout_database.sql` against the real Supabase project.** It is local-only fixture/test code, not a migration. These tests passed locally but do not claim that migration 002 has been applied or verified against the real Supabase Auth service.

## 7. Applying migration 003 manually

1. Confirm you are in the intended Supabase project and that migrations 001 and
   002 have already created `public.users` and `public.workouts`.
2. Review `supabase/migrations/003_stars.sql`.
3. In **Supabase SQL Editor → New query**, paste the entire migration and run it.
   Its transaction installs the table, constraint, index, grants, and policies
   together. It does not alter existing authentication or workout policies.
4. Verify the three columns, both foreign keys, and the unique user/workout
   constraint. Confirm the three policies and RLS:

```sql
select relrowsecurity
from pg_class
where oid = 'public.stars'::regclass;
-- true

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'stars';
-- Three authenticated policies: SELECT, INSERT, DELETE.

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.stars'::regclass;
-- Primary key, two cascading foreign keys, unique (user_id, workout_id).
```

5. Refresh Stride after migration. If the missing-migration message is already
   visible, use **Try again**.
6. With two actual accounts, verify that each sees only its own favorites and
   cannot star the other's workout UUID. Test using authenticated requests or
   `SET LOCAL ROLE authenticated` with a test JWT subject in a rollback-only
   transaction; an unrestricted SQL Editor query is not an RLS test.

The migration is safe to rerun against its own schema: it retains rows and
recreates only its own named policies. It does not repair an incompatible
pre-existing stars schema. Investigate any error instead of disabling RLS.

Local verification: `bash scripts/test-workout-database.sh` now tests migrations
001–003, including duplicate prevention, own-star insert/read/delete, forged
ownership, cross-user joins/deletes, anonymous denial, absence of UPDATE
privileges, repeat-run safety, and workout/profile cascade cleanup. It uses
synthetic identities in disposable local PostgreSQL, not remote Supabase.

## 8. Private weekly training goals

### `public.weekly_goals`

Defined in `supabase/migrations/004_training_calendar.sql`.

| Column | PostgreSQL type | Required/default | Keys and constraints |
| --- | --- | --- | --- |
| `id` | `uuid` | Required; `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | Required; `auth.uid()` | FK to `public.users.id`, `ON DELETE CASCADE` |
| `week_start` | `date` | Required | Finite Monday date; unique with `user_id` |
| `target_miles` | `numeric` | Required | Finite, nonnegative mileage; zero and decimal targets are allowed |

The unique `(user_id, week_start)` constraint permits different users to have
different goals for the same week and supports an idempotent goal upsert.
No goal row means **Not set**, not a stored zero-mile goal. Goals remain
attached to their week when a workout moves to another week. Profile deletion
cascades to that user's goals.

**Privileges and RLS:** Enabled. Anonymous/public access is revoked.
Authenticated clients have only SELECT, INSERT, and UPDATE. SELECT and UPDATE
require `auth.uid() = user_id`; INSERT and UPDATE also enforce this ownership
with `WITH CHECK`. No client DELETE privilege or policy is supplied. Clients
cannot read or modify another user's goal or transfer their own goal to a
different user.

The calendar reuses `public.workouts.date` and its existing owner-only RLS.
Rescheduling updates only `date`, scoped by both workout ID and authenticated
user ID; activity, title, status, mileage, notes, and favorites are unchanged.
Scheduled running mileage includes planned/in-progress Running entries only.
Completed running mileage includes completed Running entries only. Other
activities never contribute, and invalid distances are excluded.

### Applying and verifying migration 004

1. In the existing project's Supabase SQL Editor, run the complete contents of
   `supabase/migrations/004_training_calendar.sql`, after migrations 001–003.
2. Reload `/app/calendar`, save a goal for a Monday–Sunday week, navigate away
   and back, and refresh to confirm persistence.
3. With a separate test account, verify the first account's goals and workouts
   cannot be seen or changed. Do not disable RLS or use a service-role key in
   the frontend.
4. Local automated verification: `bash scripts/test-workout-database.sh`.
   This creates disposable PostgreSQL fixtures, applies/reruns the migrations,
   and checks goal ownership, upserts, uniqueness, date/mileage constraints,
   anonymous and identity-less denial, cross-owner date updates, and cascades.
   It does not connect to or modify remote Supabase.

## 9. Strength templates, session sets, and previous performance

Migration: `supabase/migrations/005_strength_tracker.sql`. Migrations 001–004
are unchanged. Apply 005 manually in the existing Supabase SQL Editor after
001–004, then reload **Strength**. The agent's database verification uses
disposable local PostgreSQL, not the remote project.

### `public.workout_templates`

`id uuid` PK; `user_id uuid` required FK to `public.users` with cascade;
`name text` required, trimmed length 1–120; `workout_type_id uuid` required FK
to shared activity types. A trigger restricts templates to **Strength Training**.
Unique `(id, user_id)` supports composite owner-matching child references.

### `public.exercises`

`id uuid` PK; `user_id uuid` required FK to profiles with cascade; `name text`
required, trimmed length 1–120; `name_key text` generated as lowercased/trimmed
name. Unique `(user_id, name_key)` reuses the same exercise identity across
that user's routines. Unique `(id, user_id)` protects child references. Other
users have independent exercise identities even for identical names.

### `public.template_exercises`

`id uuid` PK; `user_id uuid` profile FK/cascade; `template_id uuid` and
`exercise_id uuid` required. Composite `(template_id, user_id)` references
templates with cascade; `(exercise_id, user_id)` references exercises with a
deferred FK. `position integer` 1–30; `target_sets integer` 1–20;
`rep_min integer` 1–1000; `rep_max integer` between rep_min and 1000;
`notes text` optional, up to 2,000 characters; `optional boolean` defaults false.
The first UI uses notes and permits partial workout completion; it does not
add optional-exercise scheduling algorithms.

Unique `(template_id, position)` and `(template_id, exercise_id)` keep order
unambiguous and permit each exercise once per routine.

### `public.workout_sets`

`id uuid` PK; `user_id uuid` profile FK/cascade; `workout_id uuid` and
`exercise_id uuid` required. Owner-matching composite FKs reference workouts
(cascade) and exercises (deferred).

- `set_number integer`: 1–20; unique with `(workout_id, exercise_id)`.
- `reps integer`: nullable; whole number 0–1000.
- `weight_lbs numeric`: nullable; finite, nonnegative; zero supports unweighted
  or bodyweight entries.
- `completed boolean`: required, defaults false. Completed sets require a
  non-null weight and positive reps.
- Session snapshots: `exercise_name`, `position`, `target_sets`, `rep_min`,
  `rep_max`, and `notes`, with the same text/count/range bounds as templates.
  A trigger requires the parent to be the user's templated Strength workout.

Snapshot rows are initialized once per session. Later template edits do not
rewrite historical names, ordering, targets, notes, or actual logged results.

### Existing workout integration and deletion

Migration 005 adds nullable `workouts.template_id`, a unique `(id, user_id)`
index, and a deferred owner-matching template FK. Existing workout records,
calendar dates, auth, favorite relationships, and running totals are retained.
Starting from a routine creates a normal `in_progress` Strength workout;
applying a routine to an existing unfinished Strength workout retains its ID,
title, scheduled date, and notes. Templated/set-backed workouts cannot change
to a non-strength activity.

Deleting a workout cascades its sets. Deleting a profile cascades all its
strength records without affecting another user. Referenced exercise/template
identity is protected by FKs; client-side deletion of templates, exercises,
or individual sets is not part of this first interface.

### RLS, privileges, and atomic functions

All four tables have RLS enabled and anonymous/public access revoked.
Authenticated clients can SELECT/INSERT/UPDATE their own rows;
`template_exercises` additionally permits owner-only DELETE for atomic edits.
Child SELECT/INSERT/UPDATE policies verify the parent workout/template and
exercise also belong to the authenticated user. Composite FKs independently
reject cross-owner references. Updates cannot transfer ownership.

The following functions are **SECURITY INVOKER**, with empty search paths,
authenticated-only execution, and caller RLS still active:

- `save_strength_template`: validates and atomically replaces a routine's
  ordered exercise definitions, reusing normalized exercise identities.
- `start_strength_workout`: locks the template, creates/attaches one existing
  workout record, and snapshots all target sets atomically. It never resets
  an already initialized session.
- `save_strength_progress`: saves a batch of actual weights/reps/completion
  flags atomically. A failed row rolls back the entire batch. Finishing also
  changes the existing workout to completed in that transaction and requires
  at least one completed set; unfinished sets remain uncompleted.
- `previous_strength_performance`: returns each exercise's most recent
  earlier completed session's completed sets, ordered by workout date and
  creation time. Current, future, in-progress, uncompleted-set, and other-user
  records do not become previous performance.

Limits of 30 exercises × 20 sets bound each session to 600 rows. Loads of
templates/sets use pagination; prior-performance results are aggregated into
a scalar JSON response so row limits do not silently discard previous sets.

Local verification: `bash scripts/test-workout-database.sh` exercises real
PostgreSQL constraints, RLS, RPCs, rollbacks, snapshot preservation, identity
reuse, scheduled-workout attachment, prior results, reruns, and cascades.

## 10. Calendar usability: local start times and Rest Day

Migration: `supabase/migrations/006_calendar_improvements.sql`. Run the complete
file in the existing Supabase SQL Editor **after migrations 001–005**, then
reload the app. The agent's automated database tests use a disposable local
database; remote SQL application is not claimed.

No scheduling table is introduced. Calendar entries remain owner-scoped rows
in `public.workouts`, with the existing profile, stars, strength sets, dates,
CRUD, and four RLS policies retained.

- Adds nullable `scheduled_start_time time without time zone`. Date and time
  are separate local planning values, not a UTC timestamp or an appointment
  with an inferred timezone. Time must be within 00:00–23:59 and have zero
  seconds; null means no scheduled time.
- Seeds one shared, authenticated-read-only `workout_types` record named
  **Rest Day**, using the existing unique name constraint.
- An invoker trigger rejects Rest Day training metrics (`run_type`, distance,
  duration, target pace, elevation) or a strength template. These fields must
  be null; title/date/status/notes/time remain available.
- Existing strength invariants still prevent converting a templated or
  set-backed Strength workout to a different activity.
- Rest Day CRUD, rescheduling, and deletion use the existing workouts table
  and owner-only permissions. No RLS or grants are relaxed.
- Rest days are excluded from weekly/overall completed-workout statistics;
  Running-only mileage and weighted average pace remain unchanged.
- A date-only reschedule preserves the local time and all other fields.

Shared reads use the table's available columns, so old untimed records still
load before 006 is applied. Untouched time fields are omitted from legacy
writes; attempts to save a time without the new column show a specific
migration-006 error. The UI never invents a Rest Day activity if the seed is
missing. Migration 006 notifies PostgREST to refresh its schema cache.

Local verification includes repeat-run safety, owner isolation, rest-day CRUD,
minute/time constraints, rejected training measurements, unchanged RLS,
time preservation on rescheduling and strength attachment, and stable date/time
values under Los Angeles and Auckland database timezones.

## 11. Daily recovery check-ins

Source: `supabase/migrations/007_recovery_checkin.sql`.

| Column | PostgreSQL type | Required/default | Keys and constraints |
| --- | --- | --- | --- |
| `id` | UUID | Required, `gen_random_uuid()` | Primary key |
| `user_id` | UUID | Required, `auth.uid()` | FK to `public.users(id)`, cascades on profile deletion |
| `date` | date | Required | Finite date; unique with `user_id` |
| `sleep_hours` | numeric | Required | Finite, between 0 and 24 inclusive; decimals allowed |
| `energy_rating` | integer | Required | Between 1 and 5 inclusive |
| `soreness_rating` | integer | Required | Between 1 and 5 inclusive |
| `created_at` | timestamptz | Required, `now()` | Creation timestamp |

One user has many recovery entries, but only one per date. The application
automatically uses today's browser-local calendar date, without converting
it to UTC or allowing a date picker. Saving uses an atomic upsert on
`(user_id, date)`; updates preserve the row's ID and creation timestamp.
History is newest first, includes today's entry, and is owner-filtered.

RLS is enabled. Authenticated users have SELECT/INSERT/UPDATE grants only;
matching policies require `auth.uid() = user_id`. UPDATE checks both the old
and new owner, preventing ownership transfer. Anonymous access and application
DELETE access are not granted. Earlier workout/strength/calendar policies
are unchanged. The unique owner/date index also supports private history.

The new table is queried only on the protected Recovery route. A missing
migration shows setup/retry guidance rather than pretending no entry exists
or breaking unrelated pages. Apply **007_recovery_checkin.sql** in the existing
Supabase project before testing; it requires `public.users` from migration
001. Repository/local SQL tests do not prove remote application.

This version contains only sleep, energy, and soreness. Nutrition, injury
notes, charts, and integrations are not part of this implementation.

## 12. Planned tables — not implemented

The following remain future features from `PLAN.md`:

- `nutrition_entries`
- `nutrition_goals`

Workout logging, favorites, the dashboard, the weekly calendar, and strength
templates/set tracking are implemented. Running recommendations, advanced
progression charts, nutrition, advanced recovery analysis, analytics, and external integrations
remain deferred.
