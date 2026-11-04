---
name: Supabase migration rollout
description: Keep new database features isolated while SQL is applied separately from app code.
---

New database features must not make unrelated routes depend on an unapplied
Supabase migration.

**Why:** This project applies Supabase SQL manually, separately from code
updates. Adding a new column to a shared query can break established features
before the user has run the migration.

**How to apply:** Keep new schema dependencies in feature-specific loaders.
Report an actionable missing-migration error on that feature; never fabricate
saved data or weaken security as a fallback. Document the SQL setup step and
distinguish disposable local tests from remote application.
