---
name: Browser route matching
description: Avoid partial Playwright route interception in signed-in browser checks.
---

Use an explicit pathname regex when a controlled browser check intercepts a resource and its nested API routes.

**Why:** A trailing glob `*` matched the parent course endpoint but not `/slots` beneath it. The test silently hit the live endpoint for nested requests, making a controlled response check fail for the wrong reason.

**How to apply:** When intercepting an endpoint family with Playwright, match slash-delimited descendants explicitly and assert that the expected controlled requests were actually received. Keep sign-in real when testing authenticated UI behavior, but isolate write operations from live data.