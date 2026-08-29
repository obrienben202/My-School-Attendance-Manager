---
name: Concierge action honesty
description: Durable safety and status rules for concierge actions involving learner records, files, or external handoffs.
---

Concierge actions must report success only after the underlying record is durably saved. Learner records and files must be limited to concierge roles, and uploads must be bound to their enrolment and requester and verified on the server.

**Why:** A local success screen and client-only file checks can make an unfinished workflow look complete while exposing learner data or accepting a substituted upload. External email handoffs must likewise never be described as delivered.

**How to apply:** For new concierge mutations, persist first and navigate from the returned record; apply role checks to every related read and write; validate stored-file metadata and content before association; use precise status language for external handoffs.