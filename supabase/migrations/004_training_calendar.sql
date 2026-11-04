-- Stride: private mileage targets for Monday-start calendar weeks.
-- Run after migrations 001–003. Existing workout RLS is unchanged.
begin;

create table if not exists public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.users (id) on delete cascade,
  week_start date not null,
  target_miles numeric not null,
  constraint weekly_goals_user_week_key unique (user_id, week_start),
  constraint weekly_goals_monday check (
    week_start not in ('infinity'::date, '-infinity'::date)
    and extract(isodow from week_start) = 1
  ),
  constraint weekly_goals_valid_target check (
    target_miles >= 0
    and target_miles not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  )
);

alter table public.weekly_goals enable row level security;
revoke all on table public.weekly_goals from public, anon, authenticated;
grant select, insert, update on table public.weekly_goals to authenticated;

drop policy if exists weekly_goals_select_own on public.weekly_goals;
create policy weekly_goals_select_own on public.weekly_goals
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists weekly_goals_insert_own on public.weekly_goals;
create policy weekly_goals_insert_own on public.weekly_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists weekly_goals_update_own on public.weekly_goals;
create policy weekly_goals_update_own on public.weekly_goals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
