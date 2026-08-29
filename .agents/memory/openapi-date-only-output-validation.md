---
name: OpenAPI date-only output validation
description: Preserve calendar-date response contracts when generated Zod schemas coerce strings to Date objects.
---

When an OpenAPI response field uses `format: date`, the generated server-side Zod parser may coerce a valid `YYYY-MM-DD` string into a `Date`. Validate the response with the parser, but return the original response object when the client contract expects a calendar string.

**Why:** Returning the parser's transformed result serializes a calendar date as a full timestamp. Generated client types still declare a string, so date-only UI formatters can receive an unexpected timestamp and render incorrectly.

**How to apply:** For date-only API responses, call the generated response parser for validation without replacing the response payload with its parsed output. Continue returning real `Date` values for timestamp fields only when the contract calls for a date-time.