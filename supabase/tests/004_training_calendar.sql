-- Disposable local PostgreSQL only. Run after tests 002 and 003.
\set ON_ERROR_STOP on
\ir ../migrations/004_training_calendar.sql
reset role;
insert into auth.users (id, email) values
  ('44444444-4444-4444-8444-444444444444', 'calendar-a@example.invalid'),
  ('55555555-5555-4555-8555-555555555555', 'calendar-b@example.invalid');
insert into public.weekly_goals (user_id, week_start, target_miles) values
  ('44444444-4444-4444-8444-444444444444', '2026-11-02', 20),
  ('55555555-5555-4555-8555-555555555555', '2026-11-02', 99);
insert into public.workouts (user_id, workout_type_id, date, title, status, distance_miles)
  select '44444444-4444-4444-8444-444444444444', id, '2026-11-02', 'Calendar fixture', 'planned', 4
  from public.workout_types where name = 'Running';
\ir ../migrations/004_training_calendar.sql
do $$
begin
  if (select count(*) from public.weekly_goals) <> 2 then raise exception 'Rerun lost goals'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.weekly_goals'::regclass)
    then raise exception 'Goal RLS disabled'; end if;
  if has_table_privilege('anon', 'public.weekly_goals', 'SELECT')
    or has_table_privilege('authenticated', 'public.weekly_goals', 'DELETE')
    then raise exception 'Goal privileges too broad'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'workouts') <> 4
    then raise exception 'Workout policies changed'; end if;
end;
$$;
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
do $$
declare affected integer;
begin
  if (select count(*) from public.weekly_goals) <> 1 then raise exception 'Other user goal leaked'; end if;
  insert into public.weekly_goals (user_id, week_start, target_miles)
    values (auth.uid(), '2026-11-02', 25.5)
    on conflict (user_id, week_start) do update set target_miles = excluded.target_miles;
  if (select target_miles from public.weekly_goals) <> 25.5 then raise exception 'Upsert failed'; end if;
  insert into public.weekly_goals (week_start, target_miles) values ('2026-11-09', 0);
  perform stride_test.expect_sqlstate(
    $q$insert into public.weekly_goals (week_start, target_miles) values ('2026-11-09', 5)$q$, '23505');
  perform stride_test.expect_sqlstate(
    $q$insert into public.weekly_goals (user_id, week_start, target_miles)
      values ('55555555-5555-4555-8555-555555555555', '2026-11-16', 5)$q$, '42501');
  update public.weekly_goals set target_miles = 100 where user_id = '55555555-5555-4555-8555-555555555555';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Updated someone else goal'; end if;
  perform stride_test.expect_sqlstate(
    $q$update public.weekly_goals set user_id = '55555555-5555-4555-8555-555555555555'
      where week_start = '2026-11-09'$q$, '42501');
  perform stride_test.expect_sqlstate(
    $q$insert into public.weekly_goals (week_start, target_miles) values ('2026-11-16', -1)$q$, '23514');
  perform stride_test.expect_sqlstate(
    $q$insert into public.weekly_goals (week_start, target_miles) values ('2026-11-16', 'NaN')$q$, '23514');
  perform stride_test.expect_sqlstate(
    $q$insert into public.weekly_goals (week_start, target_miles) values ('2026-11-16', 'Infinity')$q$, '23514');
  perform stride_test.expect_sqlstate(
    $q$insert into public.weekly_goals (week_start, target_miles) values ('2026-11-16', '-Infinity')$q$, '23514');
  perform stride_test.expect_sqlstate(
    $q$insert into public.weekly_goals (week_start, target_miles) values ('2026-11-03', 5)$q$, '23514');
  perform stride_test.expect_sqlstate(
    $q$insert into public.weekly_goals (week_start, target_miles) values ('infinity', 5)$q$, '23514');
  perform stride_test.expect_sqlstate(
    $q$insert into public.weekly_goals (week_start, target_miles) values ('2026-11-16', null)$q$, '23502');
end;
$$;
-- The calendar PATCH changes only date; existing workout RLS still applies.
do $$
declare affected integer;
begin
  update public.workouts set date = '2026-11-05' where title = 'Calendar fixture';
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (
    select 1 from public.workouts where title = 'Calendar fixture'
      and date = '2026-11-05' and status = 'planned' and distance_miles = 4
  ) then raise exception 'Own workout reschedule failed or changed unrelated fields'; end if;
  update public.workouts set date = '2026-11-05'
    where user_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-owner workout update succeeded'; end if;
end;
$$;
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  if exists (select 1 from public.weekly_goals) then raise exception 'Missing identity saw private goals'; end if;
end;
$$;
reset role;
set role anon;
select stride_test.expect_sqlstate('select * from public.weekly_goals', '42501');
reset role;
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
do $$
begin
  if exists (select 1 from public.weekly_goals where user_id = '44444444-4444-4444-8444-444444444444')
    then raise exception 'Profile deletion left goals'; end if;
  if (select target_miles from public.weekly_goals where user_id = '55555555-5555-4555-8555-555555555555') <> 99
    then raise exception 'Other user goal was changed'; end if;
end;
$$;
delete from auth.users where id = '55555555-5555-4555-8555-555555555555';
