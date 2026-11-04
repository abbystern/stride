-- Stride: simple private daily recovery check-ins.
-- Requires public.users from migration 001; no existing migrations are changed.
begin;

create table if not exists public.recovery_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.users(id) on delete cascade,
  date date not null,
  sleep_hours numeric not null,
  energy_rating integer not null,
  soreness_rating integer not null,
  created_at timestamptz not null default now(),
  constraint recovery_entries_user_date_key unique (user_id, date),
  constraint recovery_entries_date_valid check (
    date not in ('infinity'::date, '-infinity'::date)
  ),
  constraint recovery_entries_sleep_valid check (
    sleep_hours >= 0 and sleep_hours <= 24
    and sleep_hours not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  constraint recovery_entries_energy_valid check (energy_rating between 1 and 5),
  constraint recovery_entries_soreness_valid check (soreness_rating between 1 and 5)
);

alter table public.recovery_entries enable row level security;
revoke all on table public.recovery_entries from public, anon, authenticated;
grant select, insert, update on table public.recovery_entries to authenticated;

drop policy if exists recovery_entries_select_own on public.recovery_entries;
create policy recovery_entries_select_own on public.recovery_entries
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists recovery_entries_insert_own on public.recovery_entries;
create policy recovery_entries_insert_own on public.recovery_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists recovery_entries_update_own on public.recovery_entries;
create policy recovery_entries_update_own on public.recovery_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
commit;
