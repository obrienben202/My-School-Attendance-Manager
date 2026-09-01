import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIlpSectionRows,
  daysOverdue,
  latestTimestamp,
  latestIlpPerStudent,
  isProgressRisk,
  registerCompletionFromDetails,
  REPORT_META,
} from "../routes/reports";

const newlyBackedReports = [
  "asmt-unconfirmed",
  "ilp-progress",
  "ilp-reviews-due",
  "ilp-completion",
  "sg-at-risk",
  "mb-grades-released",
  "att-register-progress",
] as const;

test("all formerly unavailable report definitions now declare real result columns", () => {
  for (const reportId of newlyBackedReports) {
    assert.ok(REPORT_META[reportId].columns.length > 0, `${reportId} should expose result columns`);
  }
});

test("ILP section completion aggregates persisted section states", () => {
  assert.deepEqual(buildIlpSectionRows([
    { sections: [{ name: "Learning Goals", status: "completed" }, { name: "Support Needs", status: "partial" }] },
    { sections: [{ name: "Learning Goals", status: "not_started" }, { name: "Support Needs", status: "completed" }] },
  ]), [
    ["Learning Goals", "2", "1", "0", "1", "50.0%"],
    ["Support Needs", "2", "1", "1", "0", "50.0%"],
  ]);
});

test("ILP section completion counts omitted applicable sections as not started", () => {
  assert.deepEqual(buildIlpSectionRows([
    { sections: [{ name: "Learning Goals", status: "completed" }] },
    { sections: [] },
  ]), [
    ["Learning Goals", "2", "1", "0", "1", "50.0%"],
  ]);
});

test("ILP reports count only the latest maintained ILP for each learner", () => {
  const records = [
    { studentId: 1, updatedAt: new Date("2026-08-01"), label: "old" },
    { studentId: 1, updatedAt: new Date("2026-09-01"), label: "current" },
    { studentId: 2, updatedAt: new Date("2026-08-15"), label: "only" },
  ];
  assert.deepEqual(latestIlpPerStudent(records).map((record) => record.label).sort(), ["current", "only"]);
});

test("progress-only risk comes from incomplete overdue persisted targets", () => {
  assert.equal(isProgressRisk({ completed: false, dueDate: "2026-08-31" }, "2026-09-01"), true);
  assert.equal(isProgressRisk({ completed: true, dueDate: "2026-08-31" }, "2026-09-01"), false);
  assert.equal(isProgressRisk({ completed: false, dueDate: "2026-09-02" }, "2026-09-01"), false);
});

test("review ageing and report freshness use stable date calculations", () => {
  assert.equal(daysOverdue("2026-08-29", "2026-09-01"), 3);
  assert.equal(daysOverdue("2026-09-10", "2026-09-01"), 0);

  const older = new Date("2026-08-31T09:00:00Z");
  const newer = new Date("2026-09-01T10:30:00Z");
  assert.equal(latestTimestamp([older, null, newer])?.toISOString(), newer.toISOString());
  assert.equal(latestTimestamp([]), null);
});

test("register completion uses only aggregate marked and enrolled counts", () => {
  assert.equal(registerCompletionFromDetails("Saved draft with 3 learner marks", 5), "Unmarked rows");
  assert.equal(registerCompletionFromDetails("Submitted 5 learner marks", 5), "Fully marked");
  assert.equal(registerCompletionFromDetails("Legacy audit message", 5), null);
});