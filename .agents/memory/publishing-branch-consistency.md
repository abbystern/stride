---
name: Publishing across branches
description: A healthy live snapshot can hide missing startup settings in a different checkout.
---

Check publishing commands and their declared dependencies in the current
branch, even when the existing published deployment is healthy.

**Why:** A working production startup fix was absent from the base used for
a later feature branch. The previous live snapshot kept working, but
republishing the new checkout had no production run command. Live deployment
health is not evidence that the workspace can be republished.

**How to apply:** Verify the publishing build/run settings, the referenced
package script, and its runtime dependencies together. Keep this setup in
the reviewed repository base so future branches inherit it. Do not merge or
publish automatically to accomplish that.
