---
name: Supabase query typing
description: Check installed SDK return types before changing query chaining.
---

Inspect the installed SDK signatures when changing query selections or result
typing; do not assume all result-typing methods remain chainable.

**Why:** A schema-adaptive wildcard selection produced ambiguous single-result
inference. Moving a type override earlier then removed filter/transform
methods because the override returns a base builder, not a filter builder.

**How to apply:** Keep owner filters intact, narrow single-result types through
the installed SDK's supported generics, and compile the completed query chain
before changing runtime response handling. Do not replace working cardinality
checks with unchecked casts to suppress a compiler error.
