#!/usr/bin/env bash
# Disposable local PostgreSQL tests. Never connects to the Supabase project.
set -euo pipefail
cd "$(dirname "$0")/.."

for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null || {
    echo "Missing local PostgreSQL tool: $tool" >&2
    exit 1
  }
done

test_dir="$(mktemp -d /tmp/stride-workout-db.XXXXXX)"
cleanup() {
  pg_ctl -D "$test_dir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$test_dir"
}
trap cleanup EXIT

# Unix socket only, restricted to this user; no TCP listener or password.
initdb -D "$test_dir/data" -U stride_test_admin --no-locale --encoding=UTF8 \
  --auth-local=trust --auth-host=reject >"$test_dir/init.log"
pg_ctl -D "$test_dir/data" -l "$test_dir/server.log" \
  -o "-F -k $test_dir -p 55432 -c listen_addresses='' -c unix_socket_permissions=0700" \
  -w start >/dev/null

psql_command=(psql -X --no-password -h "$test_dir" -p 55432 \
  -U stride_test_admin -d postgres -v ON_ERROR_STOP=1)

# Emulate only the Supabase identity objects needed by these migrations.
# This is not a substitute for testing the real Supabase Auth service.
"${psql_command[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text not null);
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
SQL
"${psql_command[@]}" -f supabase/migrations/001_auth_users.sql
"${psql_command[@]}" -f supabase/tests/002_workout_database.sql
"${psql_command[@]}" -f supabase/tests/003_stars.sql
"${psql_command[@]}" -f supabase/tests/004_training_calendar.sql
"${psql_command[@]}" -f supabase/tests/005_strength_tracker.sql
"${psql_command[@]}" -f supabase/tests/006_calendar_improvements.sql
"${psql_command[@]}" -f supabase/tests/007_recovery_checkin.sql
echo "PASS: migrations 001–007, validation, daily uniqueness, owner isolation, CRUD/RPCs, timezones, cascades, and RLS."
