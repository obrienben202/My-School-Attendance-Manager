import assert from "node:assert/strict";
import test from "node:test";
import type { Ilp } from "@workspace/api-client-react";
import {
  formatIlpDate,
  getReviewStatus,
  getSectionProgressLabel,
  latestIlpByStudent,
} from "./ilp.ts";

function ilp(overrides: Partial<Ilp> = {}): Ilp {
  return {
    id: 1,
    studentId: 10,
    studentName: "Alex Morgan",
    title: "Progress plan",
    content: null,
    status: "active",
    tutor: "Taylor Reed",
    academicYear: "2026/27",
    lastReviewDate: "2026-08-20",
    nextReviewDue: "2026-09-20",
    sections: [
      { name: "Goals", status: "completed" },
      { name: "Support", status: "partial" },
    ],
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    ...overrides,
  };
}

test("selects the updated ILP record used by tutor and administrator learner views", () => {
  const original = ilp();
  const updated = ilp({
    id: 2,
    tutor: "Morgan Ellis",
    academicYear: "2027/28",
    nextReviewDue: "2027-01-15",
    sections: [
      { name: "Goals", status: "completed" },
      { name: "Support", status: "completed" },
    ],
    updatedAt: "2026-09-01T10:00:00.000Z",
  });

  const selected = latestIlpByStudent([original, updated]).get(original.studentId);

  assert.equal(selected, updated);
  assert.equal(selected?.tutor, "Morgan Ellis");
  assert.equal(selected?.academicYear, "2027/28");
  assert.equal(getSectionProgressLabel(selected!), "2/2 complete");
  assert.equal(formatIlpDate(selected?.nextReviewDue), "15/01/2027");
});

test("derives tutor review urgency from the saved review dates", () => {
  assert.equal(getReviewStatus(ilp({ nextReviewDue: "2026-08-31" }), new Date(2026, 8, 1)), "Overdue");
  assert.equal(getReviewStatus(ilp({ lastReviewDate: null, nextReviewDue: "2026-09-20" }), new Date(2026, 8, 1)), "In Progress");
  assert.equal(getReviewStatus(ilp({ nextReviewDue: "2026-09-20" }), new Date(2026, 8, 1)), "In Review");
});