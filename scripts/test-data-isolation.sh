#!/usr/bin/env bash
# Real migration RLS in a disposable local database. No Supabase/network access.
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:-}"
if [[ "$#" -gt 1 || ( -n "$mode" && "$mode" != "--demonstrate-leak" ) ]]; then
  echo "Usage: bash scripts/test-data-isolation.sh [--demonstrate-leak]" >&2
  exit 2
fi
for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null || { echo "Missing local PostgreSQL tool: $tool" >&2; exit 1; }
done
test_dir="$(mktemp -d /tmp/stride-isolation.XXXXXX)"
cleanup() {
  pg_ctl -D "$test_dir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$test_dir"
}
trap cleanup EXIT
initdb -D "$test_dir/data" -U stride_test_admin --no-locale --encoding=UTF8 \
  --auth-local=trust --auth-host=reject >"$test_dir/init.log"
pg_ctl -D "$test_dir/data" -l "$test_dir/server.log" \
  -o "-F -k $test_dir -p 55432 -c listen_addresses='' -c unix_socket_permissions=0700" \
  -w start >/dev/null
sql=(psql -X -q --no-password -h "$test_dir" -p 55432 -U stride_test_admin -d postgres \
  -v ON_ERROR_STOP=1 -v VERBOSITY=terse)
"${sql[@]}" <<'SQL'
set client_min_messages=warning;
create role anon nologin nosuperuser nobypassrls;
create role authenticated nologin nosuperuser nobypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text not null);
create function auth.uid() returns uuid language sql stable
as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon, authenticated;
\ir supabase/migrations/001_auth_users.sql
\ir supabase/migrations/002_workout_database.sql
SQL
echo "User data isolation | real PostgreSQL RLS | disposable local database"
if [[ "$mode" == "--demonstrate-leak" ]]; then
  echo "TEST-ONLY DEFECT: permissive SELECT policy in this temporary database."
  "${sql[@]}" <<'SQL'
drop policy workouts_select_own on public.workouts;
create policy workouts_demo_leak on public.workouts
  for select to authenticated using (true);
SQL
else
  echo "Correct implementation: unchanged policies from migration 002."
fi
"${sql[@]}" -f supabase/tests/required_data_isolation.sql
