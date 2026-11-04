\set ON_ERROR_STOP on
\ir ../migrations/007_recovery_checkin.sql
reset role;
insert into auth.users(id,email) values
 ('abababab-abab-4bab-8bab-abababababab','recovery-a@example.invalid'),
 ('babababa-baba-4aba-8aba-babababababa','recovery-b@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','abababab-abab-4bab-8bab-abababababab',false);
insert into public.recovery_entries(date,sleep_hours,energy_rating,soreness_rating)
 values ('2026-11-04',7.5,4,2);
select set_config('stride.recovery_a',(select id::text from public.recovery_entries),false);
select set_config('stride.recovery_created',(select created_at::text from public.recovery_entries),false);
select set_config('request.jwt.claim.sub','babababa-baba-4aba-8aba-babababababa',false);
insert into public.recovery_entries(date,sleep_hours,energy_rating,soreness_rating)
 values ('2026-11-04',9,5,1);
select set_config('request.jwt.claim.sub','abababab-abab-4bab-8bab-abababababab',false);
do $$
declare affected integer;
begin
 if (select count(*) from public.recovery_entries)<>1 then raise exception 'Recovery SELECT leaked another user'; end if;
 insert into public.recovery_entries(user_id,date,sleep_hours,energy_rating,soreness_rating)
  values(auth.uid(),'2026-11-04',8,3,1)
  on conflict(user_id,date) do update set sleep_hours=excluded.sleep_hours,
    energy_rating=excluded.energy_rating,soreness_rating=excluded.soreness_rating;
 if (select count(*) from public.recovery_entries)<>1 or
  (select id::text from public.recovery_entries)<>current_setting('stride.recovery_a') or
  (select created_at::text from public.recovery_entries)<>current_setting('stride.recovery_created') or
  (select sleep_hours from public.recovery_entries)<>8
  then raise exception 'Daily upsert created a duplicate or lost identity/timestamp'; end if;
 perform stride_test.expect_sqlstate(
  $q$insert into public.recovery_entries(date,sleep_hours,energy_rating,soreness_rating) values('2026-11-04',7,2,3)$q$,'23505');
 insert into public.recovery_entries(date,sleep_hours,energy_rating,soreness_rating) values('2026-11-03',0,1,5),('2026-11-02',24,5,1);
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set sleep_hours=-1$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set sleep_hours=24.1$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set sleep_hours='NaN'$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set sleep_hours='Infinity'$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set sleep_hours='-Infinity'$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set energy_rating=0$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set energy_rating=6$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set soreness_rating=0$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set soreness_rating=6$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set sleep_hours=null$q$,'23502');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set energy_rating=null$q$,'23502');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set soreness_rating=null$q$,'23502');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set date='infinity'$q$,'23514');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set date=null$q$,'23502');
 perform stride_test.expect_sqlstate($q$insert into public.recovery_entries(user_id,date,sleep_hours,energy_rating,soreness_rating)
  values('babababa-baba-4aba-8aba-babababababa','2026-11-05',7,3,3)$q$,'42501');
 perform stride_test.expect_sqlstate($q$insert into public.recovery_entries(user_id,date,sleep_hours,energy_rating,soreness_rating)
  values('babababa-baba-4aba-8aba-babababababa','2026-11-04',7,3,3)
  on conflict(user_id,date) do update set sleep_hours=excluded.sleep_hours$q$,'42501');
 perform stride_test.expect_sqlstate($q$update public.recovery_entries set user_id='babababa-baba-4aba-8aba-babababababa'$q$,'42501');
 update public.recovery_entries set sleep_hours=1 where user_id='babababa-baba-4aba-8aba-babababababa';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Other user recovery updated'; end if;
 perform stride_test.expect_sqlstate('delete from public.recovery_entries','42501');
end;
$$;
reset role;
\ir ../migrations/007_recovery_checkin.sql
do $$
begin
 if not (select relrowsecurity from pg_class where oid='public.recovery_entries'::regclass)
  then raise exception 'Recovery RLS disabled'; end if;
 if (select count(*) from pg_policies where schemaname='public' and tablename='recovery_entries')<>3
  then raise exception 'Expected recovery SELECT/INSERT/UPDATE policies only'; end if;
 if (select count(*) from public.recovery_entries where user_id='abababab-abab-4bab-8bab-abababababab')<>3
  then raise exception 'Migration rerun lost recovery data'; end if;
end;
$$;
set role anon;
select stride_test.expect_sqlstate('select * from public.recovery_entries','42501');
select stride_test.expect_sqlstate($q$insert into public.recovery_entries(date,sleep_hours,energy_rating,soreness_rating)
 values('2026-11-04',7,3,3)$q$,'42501');
reset role;
delete from auth.users where id='abababab-abab-4bab-8bab-abababababab';
do $$
begin
 if exists(select 1 from public.recovery_entries where user_id='abababab-abab-4bab-8bab-abababababab')
  then raise exception 'Recovery profile cascade failed'; end if;
 if (select sleep_hours from public.recovery_entries where user_id='babababa-baba-4aba-8aba-babababababa')<>9
  then raise exception 'Other user recovery changed'; end if;
end;
$$;
delete from auth.users where id='babababa-baba-4aba-8aba-babababababa';
