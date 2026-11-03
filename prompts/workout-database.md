# Prompt Log: Feature 2 — Workout Database and Activity Types

## Source and scope

The following implementation prompt was supplied as an attached text file in the Replit conversation. It is reproduced verbatim below. Subsequent sections are explicitly labeled summaries, not quotations.

## Original implementation prompt — verbatim

```text
I'm continuing development of Stride, my all-in-one fitness training web app.

Read `PLAN.md` and review the existing Supabase authentication implementation before making changes.

We are working on **Feature 2: Workout Database and Activity Types**.

Current Git branch: `feature/workout-database`.

**IMPORTANT:** Only implement the workout database and activity types. Do not build workout logging forms, dashboards, nutrition tracking, or other features yet. We are developing one feature per GitHub pull request for my Intro to Coding assignment.

## 1. Create the workout_types table

Create a Supabase PostgreSQL table called `workout_types` with:

- `id`: UUID, primary key
- `name`: text, unique, required

Seed these eight activity types:

1. Running
2. Strength Training
3. Cycling
4. Pilates
5. Physical Therapy
6. Walking
7. Hiking
8. Other

Workout types should be shared reference data that authenticated users can read.

## 2. Create the workouts table

Create a Supabase PostgreSQL table called `workouts` with the following columns:

- `id`: UUID, primary key
- `user_id`: UUID, foreign key referencing `public.users.id`, required
- `workout_type_id`: UUID, foreign key referencing `workout_types.id`, required
- `date`: date, required
- `title`: text, required
- `status`: text, required; allowed values are `planned`, `in_progress`, and `completed`
- `run_type`: text, optional (easy/base, recovery, long run, tempo/threshold, VO2 max, sprints/strides)
- `distance_miles`: numeric, optional
- `duration_minutes`: numeric, optional
- `target_pace`: text, optional
- `elevation_feet`: numeric, optional
- `notes`: text, optional
- `created_at`: timestamp, default current time

Include appropriate defaults, foreign keys, and validation constraints.

Required text fields cannot be blank. Distance, duration, and elevation gain cannot be negative.

### Activity-specific requirements

**Running**
- Distance, duration, pace, elevation gain, and run type
- Supports both planned and completed workouts
- Only completed running workouts contribute to actual weekly running mileage

**Walking and Hiking**
- Optional distance, duration, elevation gain, and notes
- Tracked as separate activity types
- Do not contribute to weekly running mileage

**Strength Training**
- Supports scheduled and completed lifting sessions
- Individual exercises, sets, reps, and weights will be implemented in a later feature

**Cycling, Pilates, Physical Therapy, and Other**
- Support date, duration, status, and notes
- Cycling may optionally include distance

Keep the database flexible enough to support future Garmin activity imports.

## 3. Database security

Implement Supabase Row Level Security (RLS).

Requirements:

- Users can read only their own workouts.
- Users can create workouts only for themselves.
- Users can edit only their own workouts.
- Users can delete only their own workouts.
- Users cannot access another user's workouts, even by requesting a record directly.
- Authenticated users can read shared workout types.

Use `auth.uid()` to enforce ownership at the database level.

Do not rely solely on frontend filtering for security.

## 4. Create the SQL migration

Create:

`supabase/migrations/002_workout_database.sql`

This migration should:

- Create `workout_types` and `workouts`.
- Insert all eight activity types.
- Configure constraints, permissions, and RLS policies.
- Be safe to run more than once.
- Avoid deleting or overwriting existing workout records.

Do not assume the migration has been applied to Supabase. I will run it manually in the Supabase SQL Editor after reviewing it.

## 5. Documentation

Create:

`prompts/workout-database.md`

Include:

- This implementation prompt, preferably verbatim.
- A summary of the code and SQL created.
- Important design decisions.
- Any problems encountered and how they were addressed.
- Follow-up prompts and agent responses if changes are needed.

Also create or update:

`schema.md`

Document the database tables implemented so far, including:

- Table names
- Columns and data types
- Primary keys
- Foreign keys
- Relationships
- Row Level Security

Clearly distinguish tables already implemented from tables planned for future features.

## 6. Verification

Before finishing:

1. Verify the project builds successfully.
2. Review the migration for correct SQL syntax.
3. Confirm all eight activity types are included.
4. Explain the relationship between users, workout types, and workouts.
5. Explain how RLS prevents one user from accessing another user's workouts.
6. Give me instructions for applying and verifying the migration in Supabase.
7. Confirm that no passwords, private API keys, or `.env` files have been added to Git.

## 7. GitHub requirements

- Stay on `feature/workout-database`.
- Do not commit directly to `main`.
- Do not push to GitHub yet.
- Do not implement features outside this scope.

The next feature will implement the actual workout logging interface (create, view, edit, and delete).

Focus on making the database correct, secure, and easy to extend rather than building extra functionality.
```

## Implementation summary

**Summary — files created:**

- `supabase/migrations/002_workout_database.sql`: Transactional, repeatable table creation, eight seeds, constraints, indexes, permissions, and RLS.
- `schema.md`: Existing Auth/profile schema, the two new tables, relationships, activity semantics, RLS, manual application instructions, verification queries, and a separate list of future tables.
- `scripts/test-workout-database.sh`: Disposable local PostgreSQL test runner, with no connection to the real Supabase project.
- `supabase/tests/002_workout_database.sql`: Local-only test fixtures and assertions for migration reruns, constraints, privileges, and two-user isolation.
- `prompts/workout-database.md`: This development record.

**Summary — existing files updated:** `replit.md` now describes the pending migration and local verification command. No frontend, authentication logic, dependency, or workflow changes were needed. The existing authentication migration was left unchanged.

## Important design decisions

**Summary:**

1. **Private workouts and shared types:** Each workout references an existing `public.users` profile and one `workout_types` row. Authenticated users can read types but cannot edit reference data.
2. **Database ownership enforcement:** All four workout operations use `auth.uid()`. Updates check both the existing row and the proposed new owner, preventing ownership transfers.
3. **Defaults without reduced security:** UUIDs and creation timestamps are generated automatically. `user_id` defaults to the current authenticated user, date to the current date, and status to `planned`. Explicit forged owners are still rejected.
4. **Validation:** Required text must contain a non-whitespace character. Status is restricted to the three specified values. Optional metrics accept null or zero but reject negative and non-finite numbers.
5. **Timezone-aware timestamps:** `created_at` uses PostgreSQL `timestamptz`. Workout `date` remains a separate calendar date.
6. **Flexible future imports:** Metrics remain optional; `run_type` and `target_pace` remain text. No provider integration, external-ID schema, or import job was added.
7. **Activity semantics:** Walking and Hiking are distinct rows. Actual weekly running mileage must filter to completed Running workouts only. The rule is documented and locally tested, not implemented as a dashboard.
8. **Deletion behavior:** Removing a user profile cascades to its workouts; deleting a referenced activity type is restricted. The migration itself does not remove records.
9. **Safe repeat runs:** Table/index creation uses `IF NOT EXISTS`, seeds use `ON CONFLICT DO NOTHING`, and stable named policies are recreated inside a transaction. Existing workouts and type IDs survive a repeat run.
10. **Scope boundary:** Workout forms, exercise/set tracking, dashboards, nutrition, recovery, and Garmin integration remain deferred.

## Problems and verification

**Summary:** No implementation-blocking errors occurred in the local verification run. The existing working authentication setup was reviewed rather than replaced. To avoid claiming that local code automatically changes Supabase, the remote migration remains explicitly pending the user's review and manual execution.

The PostgreSQL test harness supplies only minimal synthetic Auth objects needed for SQL/RLS tests. It does not claim to reproduce the real Supabase Auth service. No real accounts, Supabase data, or credentials were used in these local fixtures.

**Summary — verification results:**

| Check | Result |
| --- | --- |
| `npm run build` | Passed |
| Execute migration in local PostgreSQL | Passed; syntax and statements accepted |
| All eight specified activity names | Passed |
| Rerun migration with existing workouts | Passed; existing data and type IDs preserved |
| Required values, nonblank text, valid status, valid foreign keys | Passed |
| Nonnegative, finite distance/duration/elevation | Passed |
| Own-workout create/read/update/delete and defaults | Passed |
| Direct access, update, or deletion of another user's workout | Blocked |
| Forged-owner insert or ownership-transfer update | Rejected |
| Authenticated read-only reference types | Passed; writes rejected |
| Anonymous table reads and client `TRUNCATE` | Rejected |
| Completed-running-only weekly mileage filter | Passed |

**Deployment status:** Migration 002 has not been run against Supabase by the agent. Follow the manual application and verification instructions in `schema.md` after reviewing the SQL.

## Follow-up prompts and responses

**Summary:** No follow-up correction prompt has been received for this feature at the time of writing. If changes are requested, append the actual prompt and relevant response excerpts here, clearly distinguishing quotations from summaries.

## Git and credential handling

**Summary:** Work remains on `feature/workout-database`. No commit or push commands were run for this request. No passwords, private API keys, or real `.env` files were added. `.env.example` is the existing placeholder-only template; actual `.env` files remain ignored. Local test identities use reserved example addresses and contain no account passwords.
