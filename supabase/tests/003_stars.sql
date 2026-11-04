-- LOCAL DISPOSABLE DATABASE ONLY. Uses the identity fixtures from test 002.
\set ON_ERROR_STOP on
\ir ../migrations/003_stars.sql

reset role;
insert into public.stars (id, user_id, workout_id) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   '22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  -- Even an inconsistent row inserted by an RLS-bypassing administrator must
  -- not reveal the other user's private workout through SELECT or joins.
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '11111111-1111-4111-8111-111111111111',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

\ir ../migrations/003_stars.sql
do $$
begin
  if (select count(*) from public.stars) <> 3
    then raise exception 'Migration rerun lost favorites'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.stars'::regclass)
    then raise exception 'Stars RLS is not enabled'; end if;
  if has_table_privilege('authenticated', 'public.stars', 'UPDATE')
    then raise exception 'Clients can reassign favorites'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'workouts') <> 4
    then raise exception 'Existing workout policies changed'; end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
declare affected integer; created uuid;
begin
  if (select count(*) from public.stars) <> 1
    then raise exception 'A can see another star or a private workout reference'; end if;
  if exists (
    select 1 from public.stars s join public.workouts w on w.id = s.workout_id
    where w.user_id <> auth.uid() or s.user_id <> auth.uid()
  ) then raise exception 'Stars join leaked another user workout'; end if;

  perform stride_test.expect_sqlstate(
    $q$insert into public.stars (workout_id)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$q$, '23505');
  -- The app's idempotent insert does not require UPDATE privilege.
  insert into public.stars (user_id, workout_id)
  values (auth.uid(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  on conflict (user_id, workout_id) do nothing;

  perform stride_test.expect_sqlstate(
    $q$insert into public.stars (workout_id)
       values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$q$, '42501');
  perform stride_test.expect_sqlstate(
    $q$insert into public.stars (user_id, workout_id)
       values ('22222222-2222-4222-8222-222222222222',
               'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$q$, '42501');
  perform stride_test.expect_sqlstate(
    $q$update public.stars set user_id = '22222222-2222-4222-8222-222222222222'
       where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'$q$, '42501');

  delete from public.stars where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'A deleted B favorite'; end if;
  delete from public.stars where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'A cannot unstar own workout'; end if;
  insert into public.stars (workout_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') returning id into created;
  if created is null or not exists (
    select 1 from public.stars where id = created and user_id = auth.uid()
  ) then raise exception 'Default identity or generated star ID failed'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
begin
  if (select count(*) from public.stars) <> 1
    then raise exception 'B can read A favorites'; end if;
  perform stride_test.expect_sqlstate(
    $q$insert into public.stars (workout_id)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$q$, '42501');
end;
$$;

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  perform stride_test.expect_sqlstate('select * from public.stars', '42501');
  perform stride_test.expect_sqlstate(
    $q$insert into public.stars (user_id, workout_id)
       values ('11111111-1111-4111-8111-111111111111',
               'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$q$, '42501');
  perform stride_test.expect_sqlstate('delete from public.stars', '42501');
end;
$$;

-- Workout/profile deletion removes junction rows instead of leaving orphans.
reset role;
delete from public.workouts where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$
begin
  if exists (select 1 from public.stars where workout_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    then raise exception 'Workout deletion left favorite rows'; end if;
end;
$$;
insert into auth.users (id, email)
values ('33333333-3333-4333-8333-333333333333', 'stride-c@example.invalid');
insert into public.workouts (id, user_id, workout_type_id, title)
select 'ffffffff-ffff-4fff-8fff-ffffffffffff', '33333333-3333-4333-8333-333333333333', id, 'Cascade fixture'
from public.workout_types where name = 'Running';
insert into public.stars (user_id, workout_id)
values ('33333333-3333-4333-8333-333333333333', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
delete from auth.users where id = '33333333-3333-4333-8333-333333333333';
do $$
begin
  if exists (select 1 from public.stars where user_id = '33333333-3333-4333-8333-333333333333')
    then raise exception 'Profile deletion left favorite rows'; end if;
end;
$$;
