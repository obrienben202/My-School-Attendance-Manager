import assert from "node:assert/strict";
import test from "node:test";
import { validatePlannedAbsenceInput } from "./planned-absence-validation";

test("accepts a complete future planned absence", () => {
  assert.equal(validatePlannedAbsenceInput({
    fromDate: "2026-09-10",
    toDate: "2026-09-11",
    reason: "University Visit",
  }, "2026-08-29"), null);
});

test("rejects blank reasons, impossible dates, past dates, and reversed ranges", () => {
  assert.match(validatePlannedAbsenceInput({
    fromDate: "2026-09-10",
    toDate: "2026-09-11",
    reason: " ",
  }, "2026-08-29") ?? "", /required/i);
  assert.match(validatePlannedAbsenceInput({
    fromDate: "2026-02-31",
    toDate: "2026-03-01",
    reason: "Other",
  }, "2026-01-01") ?? "", /valid/i);
  assert.match(validatePlannedAbsenceInput({
    fromDate: "2026-08-28",
    toDate: "2026-08-28",
    reason: "Other",
  }, "2026-08-29") ?? "", /today or later/i);
  assert.match(validatePlannedAbsenceInput({
    fromDate: "2026-09-11",
    toDate: "2026-09-10",
    reason: "Other",
  }, "2026-08-29") ?? "", /end date/i);
});

test("rejects invalid part-day periods", () => {
  assert.match(validatePlannedAbsenceInput({
    fromDate: "2026-09-10",
    toDate: "2026-09-10",
    reason: "Medical Appointment",
    partDay: true,
    startTime: "14:00",
    endTime: "09:00",
  }, "2026-08-29") ?? "", /valid start and end time/i);
});