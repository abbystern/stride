-- Stride Feature 1: Authenticated user profiles.
-- Run this once in the Supabase SQL Editor for your project.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

revoke all on table public.users from anon;
grant select on table public.users to authenticated;

drop policy if exists "Users can read their own profile" on public.users;
create policy "Users can read their own profile"
  on public.users
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
