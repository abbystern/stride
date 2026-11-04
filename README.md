# stride
An all-in-one fitness app for planning workouts, tracking running and strength training, logging nutrition, and monitoring recovery.

## Automated tests

```sh
npm run test:required
```

This runs the two assignment checks: actual workout row-level security in a
disposable **local** PostgreSQL database, and the dashboard's real mileage
calculation. PostgreSQL tools (`initdb`, `pg_ctl`, `psql`) must be on PATH.
No Supabase credentials, remote database, or real user records are used.

Other checks:

```sh
node --experimental-strip-types --test tests/*.test.ts
bash scripts/test-workout-database.sh
npm run test:workout-ui
npm run build
```

The browser suite requires the development server (`npm run dev`) and uses
synthetic Auth/API fixtures. Local RLS tests execute real migration policies,
but emulate Supabase identity claims rather than testing its hosted Auth service.

See [test evidence](docs/test-evidence/README.md) for safe red/green commands,
screenshots, and what each test verifies.
