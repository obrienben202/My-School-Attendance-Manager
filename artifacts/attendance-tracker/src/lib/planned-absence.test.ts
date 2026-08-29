import assert from "node:assert/strict";
import test from "node:test";
import {
  plannedAbsenceErrorMessage,
  validatePlannedAbsenceDraft,
  type PlannedAbsenceDraft,
} from "./planned-absence.ts";

const validDraft: PlannedAbsenceDraft = {
  dateType: "range",
  singleDate: "",
  rangeFrom: "2026-09-10",
  rangeTo: "2026-09-12",
  partDay: false,
  startTime: "09:00",
  endTime: "17:00",
};

test("allows a valid future absence draft", () => {
  assert.equal(validatePlannedAbsenceDraft(validDraft, "2026-08-29"), "");
});

test("blocks missing, past, reversed, and invalid part-day dates", () => {
  assert.match(validatePlannedAbsenceDraft({ ...validDraft, rangeFrom: "" }, "2026-08-29"), /required/i);
  assert.match(validatePlannedAbsenceDraft({ ...validDraft, rangeFrom: "2026-08-28" }, "2026-08-29"), /today or later/i);
  assert.match(validatePlannedAbsenceDraft({ ...validDraft, rangeFrom: "2026-09-13" }, "2026-08-29"), /end date/i);
  assert.match(validatePlannedAbsenceDraft({
    ...validDraft,
    dateType: "single",
    singleDate: "2026-09-10",
    partDay: true,
    startTime: "17:00",
    endTime: "09:00",
  }, "2026-08-29"), /start time/i);
});

test("shows the server's actionable failure or a connection fallback", () => {
  assert.equal(
    plannedAbsenceErrorMessage({ data: { error: "The selected learner could not be found." } }),
    "The selected learner could not be found.",
  );
  assert.match(plannedAbsenceErrorMessage(new Error("offline")), /connection/i);
});