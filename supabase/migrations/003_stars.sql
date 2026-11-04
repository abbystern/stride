-- Stride Feature 5: one shared, private favorites junction table.
-- Review and run after 001_auth_users.sql and 002_workout_database.sql.
begin;

create table if not exists public.stars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.users (id) on delete cascade,
  workout_id uuid not null
    references public.workouts (id) on delete cascade,
  constraint stars_user_workout_key unique (user_id, workout_id)
);

create index if not exists stars_workout_idx on public.stars (workout_id);
alter table public.stars enable row level security;

-- No client UPDATE: favorites are added or removed, never reassigned.
revoke all on table public.stars from public, anon, authenticated;
grant select, insert, delete on table public.stars to authenticated;

drop policy if exists stars_select_own on public.stars;
create policy stars_select_own on public.stars
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  );

drop policy if exists stars_insert_own_workout on public.stars;
create policy stars_insert_own_workout on public.stars
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
    )
  );

drop policy if exists stars_delete_own on public.stars;
create policy stars_delete_own on public.stars
  for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
