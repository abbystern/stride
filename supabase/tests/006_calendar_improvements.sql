\set ON_ERROR_STOP on
\ir ../migrations/006_calendar_improvements.sql
reset role;
insert into auth.users(id,email) values
 ('88888888-8888-4888-8888-888888888888','calendar-a@example.invalid'),
 ('99999999-9999-4999-8999-999999999999','calendar-b@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',false);
select set_config('stride.rest_type',(select id::text from public.workout_types where name='Rest Day'),false);
insert into public.workouts(id,workout_type_id,date,scheduled_start_time,title,status,notes)
 values ('88888888-0000-4000-8000-000000000001',current_setting('stride.rest_type')::uuid,'2026-11-04','06:30','Rest Day','planned','Take it easy');
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);
insert into public.workouts(id,workout_type_id,date,scheduled_start_time,title,status)
 values ('99999999-0000-4000-8000-000000000001',current_setting('stride.rest_type')::uuid,'2026-11-04','22:15','Private rest','completed');
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',false);
do $$
declare affected integer; tid uuid; wid uuid;
begin
 if (select count(*) from public.workouts)<>1 then raise exception 'Calendar records leaked across owners'; end if;
 update public.workouts set date='2026-11-05' where id='88888888-0000-4000-8000-000000000001';
 if (select scheduled_start_time from public.workouts limit 1)<>time '06:30'
  then raise exception 'Rescheduling lost clock time'; end if;
 update public.workouts set scheduled_start_time='23:59',notes='Rest updated' where user_id=auth.uid();
 if (select notes from public.workouts limit 1)<>'Rest updated' then raise exception 'Rest edit failed'; end if;
 perform stride_test.expect_sqlstate($q$update public.workouts set scheduled_start_time='24:00'$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.workouts set scheduled_start_time='06:30:01'$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.workouts set scheduled_start_time='06:30:00.5'$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.workouts set distance_miles=5$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.workouts set duration_minutes=40$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.workouts set target_pace='10:00'$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.workouts set run_type='Easy/Base'$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.workouts set elevation_feet=0$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.workouts set user_id='99999999-9999-4999-8999-999999999999'$q$,'42501');
 perform stride_test.expect_sqlstate($q$insert into public.workout_types(name) values('Fake Rest')$q$,'42501');
 update public.workouts set title='Not yours' where id='99999999-0000-4000-8000-000000000001';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Other owner rest day edited'; end if;
 delete from public.workouts where id='99999999-0000-4000-8000-000000000001';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Other owner rest day deleted'; end if;
 update public.workouts set scheduled_start_time=null where user_id=auth.uid();
 if exists(select 1 from public.workouts where scheduled_start_time is not null) then raise exception 'Time clearing failed'; end if;
 update public.workouts set scheduled_start_time='00:00',status='completed' where user_id=auth.uid();
 perform set_config('TimeZone','America/Los_Angeles',true);
 if (select date from public.workouts limit 1)<>date '2026-11-05' or
  (select scheduled_start_time from public.workouts limit 1)<>time '00:00' then raise exception 'LA timezone shifted scheduling'; end if;
 perform set_config('TimeZone','Pacific/Auckland',true);
 if (select date from public.workouts limit 1)<>date '2026-11-05' or
  (select scheduled_start_time from public.workouts limit 1)<>time '00:00' then raise exception 'Auckland timezone shifted scheduling'; end if;
 tid:=public.save_strength_template(null,'Timed Strength','[{"name":"Row","target_sets":1,"rep_min":8,"rep_max":10}]');
 insert into public.workouts(workout_type_id,date,scheduled_start_time,title)
  select id,'2026-11-06','17:20','Scheduled strength' from public.workout_types where name='Strength Training' returning id into wid;
 perform public.start_strength_workout(tid,'2026-11-06',wid);
 if (select scheduled_start_time from public.workouts where id=wid)<>time '17:20' then raise exception 'Strength attachment lost start time'; end if;
 delete from public.workouts where id='88888888-0000-4000-8000-000000000001';
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Own rest day deletion failed'; end if;
end;
$$;
reset role;
\ir ../migrations/006_calendar_improvements.sql
do $$
begin
 if (select count(*) from public.workout_types where name='Rest Day')<>1 then raise exception 'Rest seed not idempotent'; end if;
 if not (select relrowsecurity from pg_class where oid='public.workouts'::regclass) then raise exception 'RLS weakened'; end if;
 if (select count(*) from pg_policies where schemaname='public' and tablename='workouts')<>4 then raise exception 'Workout policies changed'; end if;
end;
$$;
set role anon;
select stride_test.expect_sqlstate('select * from public.workouts','42501');
select stride_test.expect_sqlstate('select * from public.workout_types','42501');
reset role;
delete from auth.users where id in ('88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999');
