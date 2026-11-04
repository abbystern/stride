-- Stride Feature 9. Run after 001–004. All RPCs are SECURITY INVOKER:
-- authenticated ownership policies remain active inside transactions.
begin;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  name_key text generated always as (lower(btrim(name))) stored,
  unique (user_id, name_key),
  unique (id, user_id)
);
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  workout_type_id uuid not null references public.workout_types(id),
  unique (id, user_id)
);
create table if not exists public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  template_id uuid not null,
  exercise_id uuid not null,
  position integer not null check (position between 1 and 30),
  target_sets integer not null check (target_sets between 1 and 20),
  rep_min integer not null check (rep_min between 1 and 1000),
  rep_max integer not null check (rep_max between rep_min and 1000),
  optional boolean not null default false,
  notes text check (length(notes) <= 2000),
  unique (template_id, position),
  unique (template_id, exercise_id),
  foreign key (template_id, user_id) references public.workout_templates(id, user_id) on delete cascade,
  foreign key (exercise_id, user_id) references public.exercises(id, user_id) deferrable initially deferred
);
alter table public.workouts add column if not exists template_id uuid;
create unique index if not exists workouts_id_user_key on public.workouts(id, user_id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workouts_template_owner_fk' and conrelid = 'public.workouts'::regclass) then
    alter table public.workouts add constraint workouts_template_owner_fk
      foreign key (template_id, user_id) references public.workout_templates(id, user_id)
      deferrable initially deferred;
  end if;
end;
$$;
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null,
  set_number integer not null check (set_number between 1 and 20),
  reps integer check (reps between 0 and 1000),
  weight_lbs numeric check (weight_lbs >= 0 and weight_lbs < 'Infinity'::numeric),
  completed boolean not null default false,
  -- Immutable-by-UI session snapshots, independent of later template edits.
  exercise_name text not null check (length(btrim(exercise_name)) between 1 and 120),
  position integer not null check (position between 1 and 30),
  target_sets integer not null check (target_sets between set_number and 20),
  rep_min integer not null check (rep_min between 1 and 1000),
  rep_max integer not null check (rep_max between rep_min and 1000),
  notes text check (length(notes) <= 2000),
  check (not completed or (reps is not null and reps > 0 and weight_lbs is not null)),
  unique (workout_id, exercise_id, set_number),
  foreign key (workout_id, user_id) references public.workouts(id, user_id) on delete cascade,
  foreign key (exercise_id, user_id) references public.exercises(id, user_id) deferrable initially deferred
);
create index if not exists template_exercises_owner_idx on public.template_exercises(user_id, template_id);
create index if not exists workout_sets_history_idx on public.workout_sets(user_id, exercise_id, workout_id);
create index if not exists workouts_template_idx on public.workouts(template_id);

alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workout_sets enable row level security;
revoke all on public.exercises, public.workout_templates, public.template_exercises, public.workout_sets from public, anon, authenticated;
grant select, insert, update on public.exercises, public.workout_templates, public.workout_sets to authenticated;
grant select, insert, update, delete on public.template_exercises to authenticated;

-- Each denormalized owner also has composite FKs, so a client cannot attach
-- their child row to another user's workout/template/exercise.
do $$
declare t text;
begin
  foreach t in array array['exercises', 'workout_templates', 'template_exercises', 'workout_sets'] loop
    execute format('drop policy if exists strength_read_own on public.%I', t);
    execute format('create policy strength_read_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists strength_insert_own on public.%I', t);
    execute format('create policy strength_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists strength_update_own on public.%I', t);
    execute format('create policy strength_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;
drop policy if exists strength_delete_own on public.template_exercises;
create policy strength_delete_own on public.template_exercises for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Defense in depth: child policies also check each parent's owner, rather
-- than relying only on the composite FKs to reject a cross-owner reference.
do $$
declare child text; parent text; parent_column text; predicate text;
begin
  foreach child in array array['template_exercises', 'workout_sets'] loop
    parent := case when child = 'template_exercises' then 'workout_templates' else 'workouts' end;
    parent_column := case when child = 'template_exercises' then 'template_id' else 'workout_id' end;
    predicate := format(
      '(select auth.uid()) = user_id and exists (select 1 from public.%I p where p.id = %I.%I and p.user_id = (select auth.uid())) and exists (select 1 from public.exercises e where e.id = %I.exercise_id and e.user_id = (select auth.uid()))',
      parent, child, parent_column, child);
    execute format('drop policy strength_read_own on public.%I', child);
    execute format('create policy strength_read_own on public.%I for select to authenticated using (%s)', child, predicate);
    execute format('drop policy strength_insert_own on public.%I', child);
    execute format('create policy strength_insert_own on public.%I for insert to authenticated with check (%s)', child, predicate);
    execute format('drop policy strength_update_own on public.%I', child);
    execute format('create policy strength_update_own on public.%I for update to authenticated using (%s) with check (%s)', child, predicate, predicate);
  end loop;
end;
$$;

create or replace function public.check_strength_type() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (new.template_id is not null or exists (
    select 1 from public.workout_sets where workout_id = new.id and user_id = new.user_id
  ))
    and not exists (select 1 from public.workout_types where id = new.workout_type_id and name = 'Strength Training') then
    raise exception 'A strength template/session must use the Strength Training activity.' using errcode = '23514';
  end if;
  return new;
end;
$$;
-- Separate trigger function avoids accessing template_id on a template row.
create or replace function public.check_strength_template_type() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.workout_types where id = new.workout_type_id and name = 'Strength Training') then
    raise exception 'Templates must use Strength Training.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists strength_template_type on public.workout_templates;
create trigger strength_template_type before insert or update on public.workout_templates
  for each row execute function public.check_strength_template_type();
drop trigger if exists strength_workout_type on public.workouts;
create trigger strength_workout_type before insert or update on public.workouts
  for each row execute function public.check_strength_type();

create or replace function public.check_strength_set_parent() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.workouts w join public.workout_types t on t.id = w.workout_type_id
    where w.id = new.workout_id and w.user_id = new.user_id
      and w.template_id is not null and t.name = 'Strength Training'
  ) then
    raise exception 'Sets must belong to your templated Strength Training workout.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists strength_set_parent on public.workout_sets;
create trigger strength_set_parent before insert or update on public.workout_sets
  for each row execute function public.check_strength_set_parent();

create or replace function public.save_strength_template(p_template_id uuid, p_name text, p_exercises jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare tid uuid; eid uuid; item jsonb; n integer := 0; strength_type uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to save templates.' using errcode = '42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 then raise exception 'Enter a template name (1–120 characters).'; end if;
  if jsonb_typeof(p_exercises) is distinct from 'array' then raise exception 'Add exercises to the template.'; end if;
  if jsonb_array_length(p_exercises) not between 1 and 30 then raise exception 'Add between 1 and 30 exercises.'; end if;
  select id into strength_type from public.workout_types where name = 'Strength Training';
  if strength_type is null then raise exception 'Strength Training activity is missing. Apply migration 002.'; end if;
  if p_template_id is null then
    insert into public.workout_templates(user_id, name, workout_type_id)
      values(auth.uid(), btrim(p_name), strength_type) returning id into tid;
  else
    select id into tid from public.workout_templates where id = p_template_id and user_id = auth.uid() for update;
    if tid is null then raise exception 'Template not found or unavailable to your account.' using errcode = '42501'; end if;
    update public.workout_templates set name = btrim(p_name) where id = tid;
    delete from public.template_exercises where template_id = tid and user_id = auth.uid();
  end if;
  for item in select value from jsonb_array_elements(p_exercises) loop
    n := n + 1;
    insert into public.exercises(user_id, name) values(auth.uid(), btrim(item->>'name'))
      on conflict (user_id, name_key) do update set name = public.exercises.name returning id into eid;
    insert into public.template_exercises(user_id, template_id, exercise_id, position, target_sets, rep_min, rep_max, notes)
      values(auth.uid(), tid, eid, n, (item->>'target_sets')::integer, (item->>'rep_min')::integer,
        (item->>'rep_max')::integer, nullif(btrim(item->>'notes'), ''));
  end loop;
  return tid;
end;
$$;

create or replace function public.start_strength_workout(p_template_id uuid, p_date date, p_workout_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare routine public.workout_templates%rowtype; wid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to start a workout.' using errcode = '42501'; end if;
  if p_date is null or not isfinite(p_date) then raise exception 'Choose a valid workout date.'; end if;
  select * into routine from public.workout_templates where id = p_template_id and user_id = auth.uid() for share;
  if not found then raise exception 'Template not found or unavailable.' using errcode = '42501'; end if;
  if not exists (select 1 from public.template_exercises where template_id = routine.id and user_id = auth.uid()) then
    raise exception 'Add exercises before starting this template.';
  end if;
  if p_workout_id is null then
    insert into public.workouts(user_id, workout_type_id, template_id, date, title, status)
      values(auth.uid(), routine.workout_type_id, routine.id, p_date, routine.name, 'in_progress') returning id into wid;
  else
    select id into wid from public.workouts where id = p_workout_id and user_id = auth.uid()
      and workout_type_id = routine.workout_type_id and status <> 'completed' and template_id is null for update;
    if wid is null then raise exception 'Choose your own unfinished Strength Training workout without a routine.' using errcode = '42501'; end if;
    if exists (select 1 from public.workout_sets where workout_id = wid) then raise exception 'This workout already has set entries.'; end if;
    -- Existing scheduled date/title/notes are deliberately preserved.
    update public.workouts set template_id = routine.id, status = 'in_progress' where id = wid;
  end if;
  insert into public.workout_sets(user_id, workout_id, exercise_id, set_number, exercise_name, position, target_sets, rep_min, rep_max, notes)
    select auth.uid(), wid, te.exercise_id, series.n, e.name, te.position, te.target_sets, te.rep_min, te.rep_max, te.notes
    from public.template_exercises te join public.exercises e on e.id = te.exercise_id and e.user_id = te.user_id
    cross join lateral generate_series(1, te.target_sets) series(n)
    where te.template_id = routine.id and te.user_id = auth.uid();
  return wid;
end;
$$;

create or replace function public.save_strength_progress(p_workout_id uuid, p_sets jsonb, p_finish boolean default false)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare wid uuid; item jsonb; affected integer;
begin
  select id into wid from public.workouts where id = p_workout_id and user_id = auth.uid()
    and template_id is not null and status <> 'completed' for update;
  if wid is null then raise exception 'Workout is completed, missing, or unavailable. Refresh before making changes.' using errcode = '42501'; end if;
  if jsonb_typeof(p_sets) is distinct from 'array' then raise exception 'Provide valid set entries.'; end if;
  if jsonb_array_length(p_sets) > 600 or (
    select count(*) <> count(distinct value->>'id') from jsonb_array_elements(p_sets)
  ) then raise exception 'Duplicate or excessive set entries.'; end if;
  for item in select value from jsonb_array_elements(p_sets) loop
    update public.workout_sets set reps = (item->>'reps')::integer,
      weight_lbs = (item->>'weight_lbs')::numeric, completed = (item->>'completed')::boolean
      where id = (item->>'id')::uuid and workout_id = wid and user_id = auth.uid();
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'A set is missing or unavailable; no changes were saved.' using errcode = '42501'; end if;
  end loop;
  if p_finish then
    if not exists (select 1 from public.workout_sets where workout_id = wid and user_id = auth.uid() and completed) then
      raise exception 'Complete at least one set before finishing the workout.';
    end if;
    update public.workouts set status = 'completed' where id = wid and user_id = auth.uid();
  else
    update public.workouts set status = 'in_progress' where id = wid and user_id = auth.uid();
  end if;
  return wid;
end;
$$;

create or replace function public.previous_strength_performance(p_workout_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with current_session as (
    select id, date, created_at from public.workouts where id = p_workout_id and user_id = auth.uid()
  ), latest as (
    select distinct on (s.exercise_id) s.exercise_id, w.id, w.date
    from public.workout_sets s join public.workouts w on w.id = s.workout_id and w.user_id = s.user_id
    cross join current_session c
    where s.user_id = auth.uid() and s.completed and w.status = 'completed' and w.id <> c.id
      and (w.date < c.date or (w.date = c.date and w.created_at < c.created_at))
      and exists (select 1 from public.workout_sets active where active.workout_id = c.id and active.exercise_id = s.exercise_id and active.user_id = auth.uid())
    order by s.exercise_id, w.date desc, w.created_at desc, w.id desc
  )
  select coalesce(jsonb_agg(jsonb_build_object('exercise_id', l.exercise_id, 'workout_id', l.id, 'date', l.date,
    'sets', (select jsonb_agg(jsonb_build_object('set_number', p.set_number, 'weight_lbs', p.weight_lbs, 'reps', p.reps) order by p.set_number)
      from public.workout_sets p where p.workout_id = l.id and p.exercise_id = l.exercise_id and p.user_id = auth.uid() and p.completed))), '[]'::jsonb)
  from latest l;
$$;

revoke all on function public.check_strength_type(), public.check_strength_template_type(),
  public.check_strength_set_parent(),
  public.save_strength_template(uuid,text,jsonb), public.start_strength_workout(uuid,date,uuid),
  public.save_strength_progress(uuid,jsonb,boolean), public.previous_strength_performance(uuid) from public, anon;
grant execute on function public.save_strength_template(uuid,text,jsonb), public.start_strength_workout(uuid,date,uuid),
  public.save_strength_progress(uuid,jsonb,boolean), public.previous_strength_performance(uuid) to authenticated;
commit;
