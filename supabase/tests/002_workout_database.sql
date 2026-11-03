-- LOCAL DISPOSABLE DATABASE ONLY. This file inserts synthetic Auth fixtures.
-- Run with: bash scripts/test-workout-database.sh
\set ON_ERROR_STOP on
\ir ../migrations/002_workout_database.sql

create schema stride_test;
grant usage on schema stride_test to anon, authenticated;
create function stride_test.expect_sqlstate(statement text, expected text)
returns void language plpgsql security invoker as $$
declare actual text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = expected then return; end if;
    raise exception 'Expected SQLSTATE %, got %', expected, actual;
  end;
  raise exception 'Statement unexpectedly succeeded; expected SQLSTATE %', expected;
end;
$$;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'stride-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'stride-b@example.invalid');

insert into public.workouts (id, user_id, workout_type_id, date, title, status, distance_miles)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111', id, current_date,
  'Keep this completed run', 'completed', 5
from public.workout_types where name = 'Running';
insert into public.workouts (id, user_id, workout_type_id, title)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222', id, 'Private workout B'
from public.workout_types where name = 'Strength Training';
create temp table original_types as select * from public.workout_types;

-- Repeat with existing records: IDs, activity labels, and workout data must survive.
\ir ../migrations/002_workout_database.sql
do $$
begin
  if (select count(*) from public.workout_types) <> 8
     or exists (
       select name from (values ('Running'), ('Strength Training'), ('Cycling'),
         ('Pilates'), ('Physical Therapy'), ('Walking'), ('Hiking'), ('Other')) expected(name)
       except select name from public.workout_types
     ) then raise exception 'The eight expected activity types are not present'; end if;
  if exists (select * from original_types except select * from public.workout_types)
     then raise exception 'Rerun changed activity IDs or names'; end if;
  if not exists (
    select 1 from public.workouts
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and title = 'Keep this completed run' and distance_miles = 5
  ) then raise exception 'Rerun overwrote an existing workout'; end if;
end;
$$;

-- Authenticate as A. Defaults use A's identity; all CRUD operations on A's rows work.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
declare new_id uuid; changed integer;
begin
  if (select count(*) from public.workout_types) <> 8
    then raise exception 'Authenticated users cannot read shared types'; end if;
  if exists (select 1 from public.workouts where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    then raise exception 'A can directly read B workout'; end if;
  insert into public.workouts (workout_type_id, title)
    select id, 'Own workout' from public.workout_types where name = 'Walking'
    returning id into new_id;
  if not exists (
    select 1 from public.workouts where id = new_id
      and user_id = '11111111-1111-4111-8111-111111111111'
      and status = 'planned' and date = current_date and created_at is not null
  ) then raise exception 'Workout defaults or own-row read failed'; end if;
  update public.workouts set title = 'Edited own workout', status = 'in_progress'
    where id = new_id;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Own-row update failed'; end if;
  delete from public.workouts where id = new_id;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Own-row delete failed'; end if;
  update public.workouts set title = 'Unauthorized edit'
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'A can update B workout'; end if;
  delete from public.workouts where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'A can delete B workout'; end if;
end;
$$;

select stride_test.expect_sqlstate(
  $$insert into public.workouts (user_id, workout_type_id, title)
    select '22222222-2222-4222-8222-222222222222', id, 'Forged owner'
    from public.workout_types where name = 'Running'$$, '42501');
select stride_test.expect_sqlstate(
  $$update public.workouts set user_id = '22222222-2222-4222-8222-222222222222'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, '42501');
select stride_test.expect_sqlstate(
  $$insert into public.workout_types (name) values ('Unauthorized type')$$, '42501');
select stride_test.expect_sqlstate(
  $$update public.workout_types set name = 'Changed' where name = 'Running'$$, '42501');
select stride_test.expect_sqlstate(
  $$delete from public.workout_types where name = 'Other'$$, '42501');
select stride_test.expect_sqlstate($$truncate public.workouts$$, '42501');

-- B can see B's row, not A's. Anonymous roles cannot read either table.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
begin
  if (select count(*) from public.workouts) <> 1
    or exists (select 1 from public.workouts where user_id <> auth.uid())
    then raise exception 'B row isolation failed'; end if;
end;
$$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select stride_test.expect_sqlstate($$select * from public.workouts$$, '42501');
select stride_test.expect_sqlstate($$select * from public.workout_types$$, '42501');
reset role;

-- Constraint tests run as owner so failures cannot be mistaken for RLS rejections.
select stride_test.expect_sqlstate(
  $$insert into public.workout_types (name) values ('Running')$$, '23505');
select stride_test.expect_sqlstate(
  $$insert into public.workout_types (name) values (E' \t\n')$$, '23514');
select stride_test.expect_sqlstate(
  $$insert into public.workout_types (name) values (null)$$, '23502');
do $$
declare base_sql text; invalid_column text; invalid_value text;
begin
  base_sql := format(
    'insert into public.workouts (user_id, workout_type_id, title, %I) values (%L, %L, %L, %s)',
    'status', '11111111-1111-4111-8111-111111111111',
    (select id from public.workout_types where name = 'Running'), 'Constraint test', '%s');
  perform stride_test.expect_sqlstate(format(base_sql, quote_literal('unknown')), '23514');
  foreach invalid_value in array array['', E' \t\n'] loop
    perform stride_test.expect_sqlstate(format(
      'update public.workouts set title = %L where id = %L',
      invalid_value, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '23514');
  end loop;
  foreach invalid_column in array array['user_id', 'workout_type_id', 'date', 'title', 'status'] loop
    perform stride_test.expect_sqlstate(format(
      'update public.workouts set %I = null where id = %L',
      invalid_column, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '23502');
  end loop;
  foreach invalid_column in array array['distance_miles', 'duration_minutes', 'elevation_feet'] loop
    foreach invalid_value in array array['-1', 'NaN', 'Infinity', '-Infinity'] loop
      perform stride_test.expect_sqlstate(format(
        'update public.workouts set %I = %L::numeric where id = %L',
        invalid_column, invalid_value, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '23514');
    end loop;
  end loop;
  foreach invalid_column in array array['user_id', 'workout_type_id'] loop
    perform stride_test.expect_sqlstate(format(
      'update public.workouts set %I = %L where id = %L',
      invalid_column, '99999999-9999-4999-8999-999999999999',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '23503');
  end loop;
end;
$$;

-- Demonstrate the future running-mileage filter without building a dashboard.
insert into public.workouts (user_id, workout_type_id, title, status, distance_miles)
select '11111111-1111-4111-8111-111111111111', id, 'Excluded mileage',
  case when name = 'Running' then 'planned' else 'completed' end, 20
from public.workout_types where name in ('Running', 'Walking', 'Hiking', 'Cycling');
do $$
begin
  if (
    select sum(w.distance_miles) from public.workouts w
    join public.workout_types t on t.id = w.workout_type_id
    where w.user_id = '11111111-1111-4111-8111-111111111111'
      and t.name = 'Running' and w.status = 'completed'
      and w.date >= date_trunc('week', current_date)::date
      and w.date < (date_trunc('week', current_date) + interval '1 week')::date
  ) <> 5 then raise exception 'Non-running or planned distances counted as actual running mileage'; end if;
end;
$$;
