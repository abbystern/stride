---
name: Preview server conflicts
description: Duplicate development servers can make preview runtime errors misleading.
---

Check for duplicate Vite processes before treating preview hook/import errors
as a React dependency problem.

**Why:** Invalid-hook and failed-dynamic-import errors occurred while two
development servers were running: the newer server silently moved to another
port while the preview used the older one. Matching React versions were
already deduplicated. A single fresh managed server cleared the observed errors.

**How to apply:** Use one managed workflow, stop verified orphaned project
servers, and keep strict port binding so conflicts are explicit. Avoid starting
extra development servers for tests. Reload an existing preview after cleanup
to discard stale development module state.
