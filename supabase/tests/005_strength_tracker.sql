-- Disposable local database only: real PostgreSQL constraints, RPCs and RLS.
\set ON_ERROR_STOP on
\ir ../migrations/005_strength_tracker.sql
reset role;
insert into auth.users(id,email) values
 ('66666666-6666-4666-8666-666666666666','strength-a@example.invalid'),
 ('77777777-7777-4777-8777-777777777777','strength-b@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
select set_config('stride.template_a',public.save_strength_template(null,'Upper A',
 '[{"name":"Chest Press","target_sets":2,"rep_min":8,"rep_max":10,"notes":"Controlled tempo"}]')::text,false);
select set_config('stride.old_session',public.start_strength_workout(current_setting('stride.template_a')::uuid,'2026-11-02')::text,false);
select public.save_strength_progress(current_setting('stride.old_session')::uuid,
 (select jsonb_agg(jsonb_build_object('id',id,'weight_lbs',65,'reps',10,'completed',true))
  from public.workout_sets where workout_id=current_setting('stride.old_session')::uuid),true);
select set_config('stride.active_session',public.start_strength_workout(current_setting('stride.template_a')::uuid,'2026-11-03')::text,false);
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',false);
select set_config('stride.template_b',public.save_strength_template(null,'Private B',
 '[{"name":"Chest Press","target_sets":2,"rep_min":8,"rep_max":10}]')::text,false);
select set_config('stride.session_b',public.start_strength_workout(current_setting('stride.template_b')::uuid,'2026-11-03')::text,false);
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
do $$
declare first_set uuid; second_set uuid; history jsonb; affected integer; template_count integer;
begin
 set constraints all immediate;
 if (select count(*) from public.workout_templates) <> 1 or (select count(*) from public.exercises) <> 1
  or (select count(*) from public.workout_sets) <> 4 then raise exception 'Strength RLS leaked other owner data'; end if;
 history := public.previous_strength_performance(current_setting('stride.active_session')::uuid);
 if jsonb_array_length(history)<>1 or history->0->'sets'->0->>'weight_lbs'<>'65'
  or jsonb_array_length(history->0->'sets')<>2 then raise exception 'Previous completed performance incorrect'; end if;
 perform stride_test.expect_sqlstate(
  $q$select public.save_strength_template(current_setting('stride.template_b')::uuid,'Steal','[]')$q$,'P0001');
 perform stride_test.expect_sqlstate(
  $q$select public.save_strength_template(current_setting('stride.template_b')::uuid,'Steal',
   '[{"name":"Row","target_sets":1,"rep_min":8,"rep_max":10}]')$q$,'42501');
 perform stride_test.expect_sqlstate(
  $q$select public.start_strength_workout(current_setting('stride.template_b')::uuid,'2026-11-04')$q$,'42501');
 perform stride_test.expect_sqlstate(
  $q$select public.save_strength_progress(current_setting('stride.session_b')::uuid,'[]',false)$q$,'42501');
 perform stride_test.expect_sqlstate(
  $q$select public.save_strength_progress(current_setting('stride.active_session')::uuid,'[]',true)$q$,'P0001');
 if (select status from public.workouts where id=current_setting('stride.active_session')::uuid)<>'in_progress'
  then raise exception 'Empty completion changed workout status'; end if;
 update public.workout_templates set name='Not yours' where id=current_setting('stride.template_b')::uuid;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-owner template update succeeded'; end if;
 perform stride_test.expect_sqlstate(
  $q$update public.exercises set user_id='77777777-7777-4777-8777-777777777777'$q$,'42501');
 perform stride_test.expect_sqlstate(
  $q$insert into public.template_exercises(user_id,template_id,exercise_id,position,target_sets,rep_min,rep_max)
   select auth.uid(),current_setting('stride.template_b')::uuid,id,2,3,8,10 from public.exercises limit 1$q$,'42501');
 select id into first_set from public.workout_sets where workout_id=current_setting('stride.active_session')::uuid and set_number=1;
 select id into second_set from public.workout_sets where workout_id=current_setting('stride.active_session')::uuid and set_number=2;
 perform public.save_strength_progress(current_setting('stride.active_session')::uuid,
  jsonb_build_array(jsonb_build_object('id',first_set,'weight_lbs',67.5,'reps',9,'completed',false)),false);
 if (select weight_lbs from public.workout_sets where id=first_set)<>67.5 then raise exception 'Progress not saved'; end if;
 perform stride_test.expect_sqlstate(format(
  $q$select public.save_strength_progress(%L,
   '[{"id":"%s","weight_lbs":70,"reps":10,"completed":true},{"id":"%s","weight_lbs":null,"reps":10,"completed":true}]',true)$q$,
   current_setting('stride.active_session'),first_set,second_set),'23514');
 if (select weight_lbs from public.workout_sets where id=first_set)<>67.5
  then raise exception 'Failed batch partially overwrote progress'; end if;
 perform public.save_strength_template(current_setting('stride.template_a')::uuid,'Updated Upper',
  '[{"name":" chest press ","target_sets":3,"rep_min":6,"rep_max":8,"notes":"New targets"}]');
 if (select count(*) from public.exercises)<>1 then raise exception 'Normalized exercise reuse failed'; end if;
 if exists (select 1 from public.workout_sets where workout_id=current_setting('stride.active_session')::uuid and (target_sets<>2 or rep_min<>8 or rep_max<>10))
  then raise exception 'Template edit rewrote session snapshots'; end if;
 select count(*) into template_count from public.template_exercises;
 perform stride_test.expect_sqlstate(
  $q$select public.save_strength_template(current_setting('stride.template_a')::uuid,'Bad update',
   '[{"name":"Chest Press","target_sets":3,"rep_min":6,"rep_max":8},{"name":"Chest Press","target_sets":3,"rep_min":6,"rep_max":8}]')$q$,'23505');
 if (select name from public.workout_templates where id=current_setting('stride.template_a')::uuid)<>'Updated Upper'
  or (select count(*) from public.template_exercises)<>template_count then raise exception 'Failed edit damaged template'; end if;
 perform public.save_strength_progress(current_setting('stride.active_session')::uuid,
  jsonb_build_array(jsonb_build_object('id',first_set,'weight_lbs',67.5,'reps',9,'completed',true)),true);
end;
$$;
select set_config('stride.next_session',public.start_strength_workout(current_setting('stride.template_a')::uuid,'2026-11-04')::text,false);
do $$
declare history jsonb; wid uuid; bad_id uuid;
begin
 if (select count(*) from public.workout_sets where workout_id=current_setting('stride.next_session')::uuid)<>3
  then raise exception 'Updated routine did not initialize new targets'; end if;
 history:=public.previous_strength_performance(current_setting('stride.next_session')::uuid);
 if history->0->>'workout_id'<>current_setting('stride.active_session') or jsonb_array_length(history->0->'sets')<>1
  or history->0->'sets'->0->>'weight_lbs'<>'67.5' then raise exception 'Latest completed set comparison incorrect'; end if;
 insert into public.workouts(user_id,workout_type_id,date,title,status)
  select auth.uid(),id,'2026-11-08','Scheduled lift','planned' from public.workout_types where name='Strength Training' returning id into wid;
 perform public.start_strength_workout(current_setting('stride.template_a')::uuid,'2026-11-04',wid);
 if (select date from public.workouts where id=wid)<>'2026-11-08' or
  (select title from public.workouts where id=wid)<>'Scheduled lift' then raise exception 'Attach changed scheduled workout identity'; end if;
 select id into bad_id from public.workout_types where name='Running';
 perform stride_test.expect_sqlstate(format($q$update public.workouts set workout_type_id=%L where id=%L$q$,bad_id,wid),'23514');
 perform stride_test.expect_sqlstate(
  $q$insert into public.workout_templates(name,workout_type_id) select 'Bad',id from public.workout_types where name='Running'$q$,'23514');
end;
$$;
reset role;
\ir ../migrations/005_strength_tracker.sql
do $$
begin
 if not (select bool_and(relrowsecurity) from pg_class where oid in
  ('public.exercises'::regclass,'public.workout_templates'::regclass,'public.template_exercises'::regclass,'public.workout_sets'::regclass))
  then raise exception 'Strength RLS disabled'; end if;
 if exists (select 1 from pg_proc where pronamespace='public'::regnamespace
  and proname in ('save_strength_template','start_strength_workout','save_strength_progress','previous_strength_performance') and prosecdef)
  then raise exception 'RPC bypasses caller RLS'; end if;
end;
$$;
set role anon;
select stride_test.expect_sqlstate('select * from public.workout_sets','42501');
select stride_test.expect_sqlstate('select * from public.workout_templates','42501');
select stride_test.expect_sqlstate($q$select public.previous_strength_performance('00000000-0000-4000-8000-000000000000')$q$,'42501');
reset role;
delete from auth.users where id='66666666-6666-4666-8666-666666666666';
do $$
begin
 if exists(select 1 from public.workout_sets where user_id='66666666-6666-4666-8666-666666666666')
  or exists(select 1 from public.exercises where user_id='66666666-6666-4666-8666-666666666666')
  then raise exception 'Strength profile cascade failed'; end if;
 if (select count(*) from public.workout_templates where user_id='77777777-7777-4777-8777-777777777777')<>1
  then raise exception 'Other user data damaged'; end if;
end;
$$;
delete from auth.users where id='77777777-7777-4777-8777-777777777777';
