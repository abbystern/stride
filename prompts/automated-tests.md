# Required automated tests

## Original prompt — verbatim

```text
I'm implementing the two required automated tests for my Intro to Coding final project, Stride.

Read `PLAN.md`, `schema.md`, `README.md`, and the existing application code before making changes.

**Current branch:** `test/automated-tests`

IMPORTANT:
- Do not implement new app features.
- Do not change unrelated functionality.
- Do not commit directly to `main`.
- These tests must verify the actual application's behavior.
- Keep all production data and security settings safe.

## Test 1: User Data Isolation

Write an automated test verifying that one authenticated user cannot access another user's workout data.

**Given:**
- Two distinct users, User A and User B.
- A workout belonging to User A.

**Verify:**
1. User A can read their own workout.
2. User B cannot read User A's workout.
3. User B cannot update User A's workout.
4. User B cannot delete User A's workout.
5. User A's workout remains unchanged after User B's attempts.

Test actual Supabase Row Level Security whenever a safe test environment is available. Do not rely solely on frontend navigation or mocks and claim that they prove database security.

Use disposable test accounts/data or a local test database. Never disable production RLS or modify real users' records.

## Test 2: Dashboard Mileage Calculation

Write an automated test for the actual calculation function used by Stride's dashboard.

**Test data:**
- Completed running workout: 4 miles
- Completed running workout: 5 miles
- Completed running workout: 6 miles
- Planned running workout: 8 miles

**Expected result:** 15 miles of completed running distance.

Verify that:
1. The three completed runs total 15 miles.
2. The planned 8-mile run is excluded.
3. Non-running activities are excluded.
4. The test uses the same calculation logic as the real dashboard.

If necessary, extract the dashboard calculation into a testable utility without changing its intended behavior.

## Red/Green Testing Evidence — VERY IMPORTANT

My assignment requires screenshots showing each test FAILING and then PASSING.

I need four screenshots total.

For each test:
1. Establish that the correct implementation passes.
2. Introduce a small, reversible bug that causes a meaningful test failure.
3. Run the test to show the failure.
4. Restore the correct implementation.
5. Run the test again to show it passing.

For the data isolation test, use a safe, isolated test environment or a temporary test-only defect. Do NOT weaken production Supabase security.

**PLEASE TELL ME EXACTLY WHEN TO TAKE EACH SCREENSHOT.**

Pause at these four checkpoints:

**SCREENSHOT 1 NOW: `data-isolation-fail.png`**
- Display the failing data-isolation test output.
- Explain what failed.
- Wait for me to confirm I've captured the screenshot before continuing.

**SCREENSHOT 2 NOW: `data-isolation-pass.png`**
- Restore the correct implementation.
- Display the passing test result.
- Wait for my confirmation.

**SCREENSHOT 3 NOW: `dashboard-fail.png`**
- Display the failing dashboard mileage test.
- The failure should clearly show an incorrect calculated result.
- Wait for my confirmation.

**SCREENSHOT 4 NOW: `dashboard-pass.png`**
- Restore the correct implementation.
- Display the passing dashboard test.
- Wait for my confirmation.

If you cannot actually pause between steps, provide commands that let me reproduce each failing and passing result safely.

If possible, capture all four PNG screenshots yourself and save them in:

`docs/test-evidence/`

If screenshot capture isn't supported, I will take them manually and upload them to that folder.

Make sure the screenshots show real test output, not simulated text or screenshots of an ordinary app page.

## Documentation

Create `prompts/automated-tests.md` containing:
- My original implementation prompt.
- Implementation decisions.
- Debugging and fixes.
- Test execution results.
- Explanation of the red/green demonstrations.

Create `docs/test-evidence/README.md` explaining:
- What each test verifies.
- Why the test matters.
- What result is expected.
- What code change would cause it to fail.
- How to reproduce the test.

Update `README.md` with the command for running the automated tests.

## Final Verification

Before finishing:

1. Run both automated tests successfully.
2. Run the full test suite.
3. Run the production build.
4. Confirm that temporary bugs have been removed.
5. Confirm that no secrets or real user data are committed.
6. Verify that all four screenshots exist in `docs/test-evidence/`, or tell me which ones I need to capture manually.

Commit and push the completed work only to `test/automated-tests`.

Do not merge the PR.

When you're finished, give me:
- The results of both tests.
- The location of all four screenshots.
- Any remaining manual steps.
- Confirmation that the production code is correct and both tests pass.
```

## Decisions and debugging — summary

- Reviewed the plan/schema, minimal existing README, dashboard function/tests,
  and local database runner/migrations on `test/automated-tests`.
- Existing dashboard utility already contains the production calculation;
  no extraction or production feature change is needed. Strengthened its
  required 15-mile test with completed walking/cycling fixtures and an
  overall-mileage assertion.
- Added a focused real-RLS test against migrations 001–002, with distinct
  synthetic A/B identities. Compare A's entire original row after B's
  attempted reads/updates/deletes, not just frontend visibility.
- Local PostgreSQL uses an isolated private Unix socket with TCP disabled.
  Supabase Auth identity claims are emulated, but actual PostgreSQL roles,
  policies, constraints, and row operations are exercised.
- Intentional failures use only a disposable database policy or temporary
  copy of the real calculation. Normal commands always use correct production
  migrations/function; neither committed source nor hosted security is weakened.
- PNGs show actual captured test output in a read-only browser viewer.
  They are not native terminal captures; raw transcripts and direct commands
  are provided for manual terminal screenshots if required.
- An initial uploaded prompt was truncated; waited for the complete version
  before implementing these tests.

## Results and checkpoint progress

- Correct baseline: `npm run test:required` passed both tests.
- Isolation baseline: all five real-RLS checks passed.
- Dashboard baseline: completed 4 + 5 + 6 = 15 miles; planned 8 and completed
  walking/cycling are excluded.
- Red/green screenshots and final full-suite/build results are recorded as
  the user confirms each required checkpoint. No commit/push until completion.
- Screenshot 1 generated: `docs/test-evidence/data-isolation-fail.png`,
  with its actual-output `.txt` transcript. The intentional local SELECT-policy
  defect exposed one A row to B (expected zero), producing test exit code 3.
  Other assertions passed and A's row stayed unchanged. The temporary cluster
  was destroyed automatically; production policies/source remain untouched.
  User confirmed screenshot 1 was captured before proceeding.
- Screenshot 2 generated: `docs/test-evidence/data-isolation-pass.png`,
  with its actual-output `.txt` transcript. The unmodified migration policies
  passed all five isolation checks, with test exit code 0. B read/updated/deleted
  zero A rows, and A's full original row remained unchanged.
  User confirmed screenshot 2 was captured before proceeding.
- Screenshot 3 generated: `docs/test-evidence/dashboard-fail.png`,
  with its actual-output `.txt` transcript. The temporary calculation copy
  admitted the planned 8-mile run and failed the unchanged assertion:
  actual 23, expected 15, test exit code 1. Temporary copies were deleted;
  production source remains correct and untouched.
  User confirmed screenshot 3 was captured before proceeding.
- Screenshot 4 generated: `docs/test-evidence/dashboard-pass.png`,
  with its actual-output `.txt` transcript. The real, unmodified dashboard
  function passed the 15-mile assertion, with test exit code 0.
  User confirmed screenshot 4 was captured before final verification began.

## Final verification

- Both required tests passed again after all four screenshot confirmations.
- All **51** unit tests passed.
- The complete local database suite for this branch passed, including
  migrations, workout/star/goal/strength behavior, validation, and RLS.
- Production build passed; the existing Vite large-chunk advisory is nonblocking.
- All four PNGs and actual-output transcripts exist. No temporary dashboard
  mutation directory remains, and hosted security was never changed.
- All **70 desktop/mobile browser tests passed** in the completed background
  run (3.9 minutes, exit code 0). The initial foreground attempt had exceeded
  its shell time limit after passing 20 checks, without a test failure.
- Compared production source and migrations with the pre-test baseline:
  unchanged. All intentional defects are confined to temporary test-only
  resources and have been cleaned up.
- Reviewed changed paths for `.env` files and recognized password/secret
  literals: none found. Evidence contains only synthetic fixture data.
- No hosted migrations, production security changes, or new app features
  were required. All four screenshot checkpoints were confirmed by the user
  before final verification and commit/push on `test/automated-tests`.
