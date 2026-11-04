-- Apply after migrations 001–005 in the Supabase SQL Editor.
-- Retains existing workout records and their owner-only RLS.
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workouts' and column_name = 'template_id'
  ) then
    raise exception 'Apply migration 005_strength_tracker.sql before migration 006.';
  end if;
end;
$$;

alter table public.workouts
  add column if not exists scheduled_start_time time without time zone;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.workouts'::regclass
      and conname = 'workouts_start_time_valid'
  ) then
    alter table public.workouts add constraint workouts_start_time_valid check (
      scheduled_start_time is null or (
        scheduled_start_time >= time '00:00' and scheduled_start_time < time '24:00'
        and extract(second from scheduled_start_time) = 0
      )
    );
  end if;
end;
$$;

insert into public.workout_types(name) values ('Rest Day')
  on conflict (name) do nothing;

create or replace function public.check_rest_day() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.workout_types where id = new.workout_type_id and name = 'Rest Day'
  ) and (
    new.template_id is not null or new.run_type is not null or
    new.distance_miles is not null or new.duration_minutes is not null or
    new.target_pace is not null or new.elevation_feet is not null
  ) then
    raise exception 'Rest days cannot include training measurements or strength templates.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.check_rest_day() from public, anon, authenticated;
drop trigger if exists workout_rest_day_valid on public.workouts;
create trigger workout_rest_day_valid before insert or update on public.workouts
  for each row execute function public.check_rest_day();

notify pgrst, 'reload schema';
commit;
