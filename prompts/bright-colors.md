# Bright colors: visual-only presentation update

## Original request (verbatim)

> I want to give Stride a brighter, bolder visual identity before presenting my app.
>
> Read the existing styles and components first. Work on branch `design/bright-colors` from the latest main.
>
> IMPORTANT: This is a visual-only update. Do not change functionality, database schema, data calculations, or routing.
>
> ### Design direction
>
> Stride should feel like a modern, energetic fitness brand: fresh, confident, and visually distinctive, while still clean and professional.
>
> Replace the overly muted sage-heavy palette with brighter colors:
>
> - Vivid cobalt blue: #345CFF
> - Bright coral: #FF654F
> - Fresh lime: #D7F45B
> - Warm cream background: #FAF9F5
> - Dark ink text: #22252A
>
> ### Changes
>
> 1. Make primary buttons and active navigation states cobalt blue.
> 2. Make the running mileage chart bars cobalt blue so they stand out clearly.
> 3. Use coral selectively for highlights, activity indicators, or emphasis.
> 4. Use lime for mileage-goal progress or positive training indicators, with dark text for contrast.
> 5. Maintain readable dark text on light backgrounds.
> 6. Give the dashboard stronger visual hierarchy while preserving its existing structure.
> 7. Apply the palette consistently to the calendar, workout logging, strength tracker, and recovery page.
> 8. Keep cards, borders, spacing, and typography minimal and polished.
>
> ### Guardrails
>
> - No gradients.
> - No animations.
> - No stock illustrations.
> - No major layout changes.
> - No unnecessary decorative elements.
> - Preserve accessible text contrast.
> - Don't introduce new dependencies.
> - Don't change functionality or test logic.
>
> ### Verification
>
> Run the production build and existing tests.
>
> Check dashboard and calendar screenshots at desktop and mobile sizes.
>
> Document the change in `prompts/bright-colors.md`.
>
> Commit and push only the design branch. Do not merge automatically.

## Implementation summary (not a verbatim response)

- Confirmed `design/bright-colors` matched the freshly fetched `origin/main`
  before editing.
- Reviewed existing shared/page styles and components rather than replacing
  the app or introducing a new layout.
- Replaced sage color tokens and relevant hard-coded presentation colors with
  the requested palette. Kept warm light surfaces, dark readable text, subtle
  neutral borders, existing typography, and responsive page structures.
- Applied cobalt to primary actions, selected navigation, focus indicators,
  and the running-mileage chart. Used coral selectively for activity/emphasis
  and lime for positive/progress treatments with dark text.
- Strengthened dashboard headings and metric emphasis without changing
  statistics, eligibility filters, chart data, or page structure.
- Updated authentication/shared navigation, workouts, search/filter, calendar,
  strength, and recovery styles consistently.
- Removed CSS transitions and other motion styling. Bar animation remains
  disabled, and tooltip animation is explicitly disabled too; chart changes
  are presentation-only.
- Darkened remaining muted helper/footer/placeholder text for readable
  contrast, including calendar empty states and adjacent-month dates.

Changed presentation files: `src/styles.css`, `src/workouts.css`,
`src/search-filter.css`, `src/dashboard.css`, `src/calendar.css`,
`src/strength.css`, `src/recovery.css`, and chart presentation attributes in
`src/pages/DashboardPage.tsx`.

No routes, hooks, data calculations, authentication behavior, SQL migrations,
dependencies, or existing test files were changed.

## Verification

| Check | Result |
| --- | --- |
| `npm run build` | Passed. The existing warning about chunks over 500 kB remains non-blocking. |
| `node --experimental-strip-types --test tests/*.test.ts` | All 61 tests passed, including the dashboard calculation regressions. |
| `npm run test:data-isolation` | All five isolation assertions passed in a disposable local PostgreSQL database. |
| `bash scripts/test-workout-database.sh` | Passed through migrations 001–007, including validation, CRUD, ownership/RLS, and recovery uniqueness. |
| `npm run test:workout-ui` | All 88 desktop/mobile browser tests passed, without changing test logic. |
| `git diff --check` | Passed. |
| Non-visual scope check | Hooks, calculation modules, routes, SQL migrations, dependencies, and existing tests are unchanged from `origin/main`. After normalizing hex colors and disabled-animation props, the dashboard TSX matches the original. |
| Desktop/mobile visual checks | All four captures passed the mileage, chart-color, overflow, and runtime-error assertions. |

The dashboard retains its weekly/overall groups and chart. Desktop keeps
the side-by-side statistic groups; mobile keeps the existing stacked
structure. Cobalt running totals and chart bars give the important numbers
more emphasis without changing the information.

The weekly calendar keeps its Monday–Sunday desktop grid and mobile day
list. The weekly-goal area is lime with dark text; the selected view and save
action are cobalt, and coral is limited to activity/status emphasis and
today's outline.

Representative normal-text contrast checks:

- White on cobalt: **5.10:1**.
- Ink on coral: **5.29:1**.
- Ink on lime: **12.43:1**.
- Muted `#666B73` text on cream: **5.09:1**.

These exceed WCAG AA's 4.5:1 threshold for normal text. Small text on pale
cobalt surfaces uses the darker cobalt shade rather than the vivid accent.

### Screenshot method

Dashboard and calendar screenshots use the existing synthetic Auth/PostgREST
fixture from `tests/browser/support/calendarBackend.ts`. Only the temporary
verification script seeds sample workouts/goals. Application authentication
and RLS stay enabled; no live account, privileged key, or production record
is used.

The checks use 1440 × 1000 desktop and 390 × 844 mobile viewports. Captures
and the temporary script live under the already Git/deployment-ignored
`generated-artifacts/bright-colors/` directory, not in the commit:

- `dashboard-desktop.png`
- `dashboard-mobile.png`
- `calendar-desktop.png`
- `calendar-mobile.png`
- `report.json`

The fixture verifies 8.0 completed running miles on the dashboard and 8.0
completed / 8.0 scheduled running miles on the calendar. It also checks
cobalt chart bars, horizontal overflow, and browser runtime errors. These
are visual checks with synthetic sessions, not a live Supabase login test.

## Republishing follow-up

User report (verbatim): "there's an error with republishing"

Diagnosis summary: The current design branch did not contain the production
startup configuration used by the previous successful deployment. It lacked
both the publishing build/run settings and an `npm start` script, although
the already-published snapshot remained available.

Restored the previously used `serve` dependency and `npm start` command to
serve the built `dist/` directory on `0.0.0.0`, using `PORT` or port 5000.
Publishing keeps the existing Autoscale target, builds with `npm run build`,
and runs with `npm start`. This is separate from the visual changes: no UI,
authentication, data, database, calculation, or routing code was modified.

The publishing configuration must be included in the repository base used
for future branches; a successful live snapshot does not configure a new
checkout automatically. No merge or production publish was performed.

Verification: the production build passed; `npm start` served HTTP 200 and
the SPA document at `/`, `/login`, `/signup`, `/app/dashboard`, and
`/app/calendar`; built JavaScript was served with the correct content type.
The temporary verification process was stopped. Existing dependency
versions are unchanged; only the missing static-server dependency was
restored. Private page rendering was not re-tested with a live account.
