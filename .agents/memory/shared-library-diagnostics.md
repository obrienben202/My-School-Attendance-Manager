---
name: Shared-library diagnostics after merges
description: Distinguish stale shared-library declarations from genuine compiler errors following task merges.
---

After task merges, rebuild shared TypeScript library references before treating missing database fields or generated API exports as new source-code defects.

**Why:** Merged source and the running bundle can contain the correct additions while the type checker still reads older compiled shared-library declarations. This previously produced misleading missing-field/export errors.

**How to apply:** Run the workspace's library type-build first, then the affected package type check. Investigate remaining diagnostics normally; do not rewrite valid source to match stale declarations.