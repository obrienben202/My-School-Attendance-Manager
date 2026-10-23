import assert from "node:assert/strict";
import test from "node:test";
import { formatDateOnly, toLocalDateOnlyValue, toSchoolDateOnlyValue } from "./date-only.ts";

test("uses the local calendar day rather than the UTC day", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "Europe/London";

  try {
    const nearMidnight = new Date("2026-08-29T23:30:00.000Z");
    assert.equal(toLocalDateOnlyValue(nearMidnight), "2026-08-30");
  } finally {
    process.env.TZ = previousTimezone;
  }
});

test("formats date-only values without shifting the calendar day", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";

  try {
    assert.equal(formatDateOnly("2026-08-29"), "29/08/2026");
  } finally {
    process.env.TZ = previousTimezone;
  }
});

test("school date follows London daylight saving regardless of the viewer's timezone", () => {
  assert.equal(toSchoolDateOnlyValue(new Date("2026-09-27T22:30:00Z")), "2026-09-27");
  assert.equal(toSchoolDateOnlyValue(new Date("2026-09-27T23:30:00Z")), "2026-09-28");
  assert.equal(toSchoolDateOnlyValue(new Date("2026-11-01T00:30:00Z")), "2026-11-01");
});