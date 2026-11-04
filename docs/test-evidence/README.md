# Required automated test evidence

## User data isolation

`npm run test:data-isolation` starts a fresh, socket-only local PostgreSQL
cluster, applies the real authentication/workout migrations 001 and 002,
and creates two synthetic users and one workout owned by A.

Assertions run as the non-superuser/non-BYPASSRLS `authenticated` role.
Local identity claims change from A to B to A, exercising the real
`auth.uid()`-based workout policies:

1. A reads their workout (one row).
2. B reads none of A's workout.
3. B updates none of A's workout.
4. B deletes none of A's workout.
5. A's entire stored row, including its ID/timestamps/metrics, is unchanged.

This protects private workout data. Frontend navigation or mock filtering
cannot prove this property, so the assertions execute actual PostgreSQL RLS.
Only Supabase identity objects/claims are emulated; the hosted Auth service
and HTTP/JWT verification are not tested by this local database check.

The red demonstration deliberately replaces the SELECT policy with `true`
**only inside the new disposable local cluster**. B then reads A's row:
expected 0, actual 1. Update/delete remain blocked; the original row is intact.
The runner always destroys the cluster afterward, including on failure.
It never connects to Supabase or changes a committed migration.

## Dashboard mileage

`npm run test:required-dashboard` imports `calculateDashboard` from the same
`src/lib/dashboard.ts` used by the dashboard hook. The existing required test
now includes completed runs of 4, 5, and 6 miles, a planned 8-mile run, and
completed walking/cycling distances. Weekly mileage, the current chart bucket,
and overall running mileage must each equal **15**.

This prevents planned and non-running distances from inflating running totals.
The red demonstration copies the real calculation and test into an ignored
temporary directory, then changes only the completed-status guard in that
copy to admit planned workouts. The unchanged 15-mile assertion fails with
**23** miles. Production source and test expectations are never edited;
the temporary copies are removed even on failure.

## Reproduce each checkpoint

First establish the correct implementation passes:

```sh
npm run test:required
```

Run these **one at a time**, taking/confirming each screenshot before the next:

```sh
# SCREENSHOT 1: expected failure; CLI exits nonzero.
bash scripts/test-data-isolation.sh --demonstrate-leak
# SCREENSHOT 2: restored/default migration policies, expected pass.
npm run test:data-isolation
# SCREENSHOT 3: temporary calculation defect; expected 23 != 15 failure.
node scripts/demonstrate-dashboard.mjs
# SCREENSHOT 4: real unmodified production calculation, expected pass.
npm run test:required-dashboard
```

No production defect is left active between checkpoints. Restoring means
running the normal command without the test-only defect option or temp copy.
The temporary local database and temp calculation files are always destroyed.

### Automatic PNG capture

The following commands run the real corresponding test, print its actual
output, and take a PNG screenshot of that captured output in a read-only
browser log viewer. These are **not native terminal-window screenshots**,
mocked results, manually typed failure text, or ordinary app-page screenshots.
Matching `.txt` transcripts preserve the actual command, stdout/stderr,
and test exit status. The capture command accepts an expected failing test,
but refuses to save evidence if the expected result was not observed.

```sh
node scripts/capture-test-output.mjs data-isolation-fail
node scripts/capture-test-output.mjs data-isolation-pass
node scripts/capture-test-output.mjs dashboard-fail
node scripts/capture-test-output.mjs dashboard-pass
```

Requires the existing Playwright dependency and working system Chromium;
uses the same browser executable override as the existing browser suite.
If native terminal screenshots are required by the instructor, run the direct
commands above in Replit Shell and take screenshots manually instead.

| Checkpoint | PNG path | Expected actual test result |
| --- | --- | --- |
| 1 | `docs/test-evidence/data-isolation-fail.png` | FAIL: B reads one private A row instead of zero |
| 2 | `docs/test-evidence/data-isolation-pass.png` | PASS: all five isolation checks |
| 3 | `docs/test-evidence/dashboard-fail.png` | FAIL: calculated 23 miles, expected 15 |
| 4 | `docs/test-evidence/dashboard-pass.png` | PASS: calculated 15 miles |

These are small assignment evidence assets intended to be committed.
Local database files, temporary source copies, and bulk browser artifacts
are not committed. Never put passwords, tokens, `.env` files, or real user
records in evidence.
