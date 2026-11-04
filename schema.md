# Stride database schema

## Implementation and deployment status

| Component | Repository status | Supabase status |
| --- | --- | --- |
| Supabase-managed `auth.users` | Managed by Supabase Auth | Existing authentication is working, as confirmed by the user |
| `public.users` | Defined in `001_auth_users.sql` | User previously applied the migration and verified a profile |
| `public.workout_types` | Defined and locally tested in `002_workout_database.sql` | Available in the user's successful Feature 3 manual tests |
| `public.workouts` | Defined and locally tested in `002_workout_database.sql` | User confirmed real CRUD and persistence in Feature 3 |
| `public.stars` | Defined in `003_stars.sql`, with local security tests | User confirmed Feature 5 is working; remote schema not independently inspected |

Authentication and workout logging/validation are implemented. Feature 5 adds
private favorites and a Starred Workouts page. There are still no dashboards or
wearable integrations. Repository files do not prove a migration was applied
remotely; migration 003 has not been applied by the agent.

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
| `date` | `date` | Required; `current_date` | Workout's planned or actual calendar date |
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
| Strength Training | Planned, in-progress, or completed session; exercises, sets, reps, and weights deferred |
| Cycling | Date, duration, status, notes, and optional distance |
| Pilates / Physical Therapy / Other | Date, duration, status, notes |

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

## 8. Planned tables — not implemented

The following remain future features from `PLAN.md`:

- `workout_templates`
- `exercises`
- `template_exercises`
- `workout_sets`
- `weekly_goals`
- `nutrition_entries`
- `nutrition_goals`
- `recovery_entries`

`workouts.template_id` is also deferred until the template feature. Workout
logging and favorites are implemented; dashboards, nutrition/recovery tables,
analytics, and external integrations remain deferred.
