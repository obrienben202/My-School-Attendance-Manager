---
name: Staff browser checks
description: Stable signed-in register checks when staff assignments vary across the live environment.
---

Do not assume the configured staff test account always has active timetable assignments. Wait for the signed-in interface to appear before navigating after login, and use a controlled schedule response to exercise daily-list states if the live feed is empty.

**Why:** The authentication endpoint can report a valid staff session before the login UI finishes its redirect; navigating immediately can interrupt the request. Timetable assignments also change independently of code, so a browser check that requires a nonempty live feed can fail even when the feature works.

**How to apply:** When writing signed-in staff browser checks, assert the real feed's scope and distinguish no assignments from no lessons today; use deterministic fixtures for list behavior and only assert detail data when the selected lesson actually exists.