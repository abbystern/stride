-- Execute only through scripts/test-data-isolation.sh (disposable local DB).
\set ON_ERROR_STOP on
insert into auth.users(id,email) values
 ('10101010-1010-4010-8010-101010101010','isolation-a@example.invalid'),
 ('20202020-2020-4020-8020-202020202020','isolation-b@example.invalid');
insert into public.workouts(id,user_id,workout_type_id,date,title,status,distance_miles)
 select 'adadadad-adad-4dad-8dad-adadadadadad',
 '10101010-1010-4010-8010-101010101010', id,
 '2026-11-04','Synthetic owner A workout','completed',4
 from public.workout_types where name='Running';

-- Assertions execute as the non-superuser, non-BYPASSRLS authenticated role.
set role authenticated;
do $$
declare
 original jsonb;
 unchanged jsonb;
 found_rows integer;
 affected integer;
 failures integer := 0;
 target_id constant uuid := 'adadadad-adad-4dad-8dad-adadadadadad';
begin
 if current_user <> 'authenticated' or
   (select rolsuper or rolbypassrls from pg_roles where rolname=current_user)
 then raise exception 'Unsafe test role: expected authenticated without RLS bypass'; end if;
 perform set_config('request.jwt.claim.sub','10101010-1010-4010-8010-101010101010',true);
 select count(*) into found_rows from public.workouts where id=target_id;
 if found_rows=1 then raise info 'PASS 1/5: User A reads own workout (expected 1, actual %)',found_rows;
 else failures:=failures+1; raise info 'FAIL 1/5: User A read (expected 1, actual %)',found_rows; end if;
 select to_jsonb(w) into original from public.workouts w where id=target_id;

 perform set_config('request.jwt.claim.sub','20202020-2020-4020-8020-202020202020',true);
 select count(*) into found_rows from public.workouts where id=target_id;
 if found_rows=0 then raise info 'PASS 2/5: User B cannot read A workout (expected 0, actual %)',found_rows;
 else failures:=failures+1; raise info 'FAIL 2/5: User B CAN READ A workout (expected 0, actual %)',found_rows; end if;
 update public.workouts set title='Unauthorized edit',distance_miles=99 where id=target_id;
 get diagnostics affected=row_count;
 if affected=0 then raise info 'PASS 3/5: User B cannot update A workout (affected rows %)',affected;
 else failures:=failures+1; raise info 'FAIL 3/5: User B updated A workout (affected rows %)',affected; end if;
 delete from public.workouts where id=target_id;
 get diagnostics affected=row_count;
 if affected=0 then raise info 'PASS 4/5: User B cannot delete A workout (affected rows %)',affected;
 else failures:=failures+1; raise info 'FAIL 4/5: User B deleted A workout (affected rows %)',affected; end if;

 perform set_config('request.jwt.claim.sub','10101010-1010-4010-8010-101010101010',true);
 select to_jsonb(w) into unchanged from public.workouts w where id=target_id;
 if original is not null and unchanged=original then raise info 'PASS 5/5: User A workout remains completely unchanged';
 else failures:=failures+1; raise info 'FAIL 5/5: User A original row was changed or deleted'; end if;
 if failures>0 then raise exception 'FAIL: % of 5 data isolation checks failed',failures; end if;
 raise info 'PASS: all 5 data isolation checks passed';
end;
$$;
