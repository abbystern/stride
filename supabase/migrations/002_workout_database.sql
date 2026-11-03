-- Stride Feature 2: workout storage and shared activity types.
-- Review, then run in Supabase SQL Editor after 001_auth_users.sql.
-- This transaction does not delete or overwrite existing workout records.
begin;

create table if not exists public.workout_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  constraint workout_types_name_not_blank check (name ~ '[^[:space:]]')
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.users (id) on delete cascade,
  workout_type_id uuid not null
    references public.workout_types (id) on delete restrict,
  date date not null default current_date,
  title text not null,
  status text not null default 'planned',
  run_type text,
  distance_miles numeric,
  duration_minutes numeric,
  target_pace text,
  elevation_feet numeric,
  notes text,
  created_at timestamptz not null default now(),
  constraint workouts_title_not_blank check (title ~ '[^[:space:]]'),
  constraint workouts_status_valid
    check (status in ('planned', 'in_progress', 'completed')),
  -- Optional metrics may be null, but cannot be negative, infinite, or NaN.
  constraint workouts_distance_valid
    check (distance_miles >= 0 and distance_miles < 'Infinity'::numeric),
  constraint workouts_duration_valid
    check (duration_minutes >= 0 and duration_minutes < 'Infinity'::numeric),
  constraint workouts_elevation_valid
    check (elevation_feet >= 0 and elevation_feet < 'Infinity'::numeric)
);

insert into public.workout_types (name)
values
  ('Running'),
  ('Strength Training'),
  ('Cycling'),
  ('Pilates'),
  ('Physical Therapy'),
  ('Walking'),
  ('Hiking'),
  ('Other')
on conflict (name) do nothing;

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, date desc);
create index if not exists workouts_type_idx
  on public.workouts (workout_type_id);

alter table public.workout_types enable row level security;
alter table public.workouts enable row level security;

-- Reset client-role privileges, including privileges inherited from PUBLIC.
-- There is no client-side way to edit shared reference data or bypass RLS.
revoke all on table public.workout_types from public, anon, authenticated;
revoke all on table public.workouts from public, anon, authenticated;
grant select on table public.workout_types to authenticated;
grant select, insert, update, delete on table public.workouts to authenticated;

drop policy if exists workout_types_read_authenticated on public.workout_types;
create policy workout_types_read_authenticated
  on public.workout_types
  for select
  to authenticated
  using (true);

drop policy if exists workouts_select_own on public.workouts;
create policy workouts_select_own
  on public.workouts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists workouts_insert_own on public.workouts;
create policy workouts_insert_own
  on public.workouts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists workouts_update_own on public.workouts;
create policy workouts_update_own
  on public.workouts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists workouts_delete_own on public.workouts;
create policy workouts_delete_own
  on public.workouts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
