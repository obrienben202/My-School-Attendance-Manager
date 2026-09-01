---
name: User-scoped feed caching
description: Why authenticated dynamic list endpoints must avoid conditional caching in this proxied web app.
---

Authenticated dynamic feeds must opt out of browser and proxy caching at both the response and request boundaries.

**Why:** A user-scoped list could load successfully once, then receive a conditional `304 Not Modified` on later reloads. In the proxied preview path, that left the query without a usable response body and the UI showed its generic load-error state even though the backend and database were healthy.

**How to apply:** For authenticated feeds whose response depends on the current user or mutable operational state, send a private no-store response and make callers request with no-store semantics. Regression checks should include several full page reloads, not only the first successful request.