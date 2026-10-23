import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRegisterProgressData,
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

test("register progress report keeps latest outcomes aggregate and privacy-safe", () => {
  const privateNote = "PRIVATE FIXTURE NOTE MUST NOT BE IN REPORT";
  const baseEvents = [
    {
      scheduleId: 101,
      date: "2026-09-01",
      action: "saved_draft",
      details: `Saved draft with 3 learner marks: Fixture Learner One present; ${privateNote}`,
      createdAt: new Date("2026-09-01T09:05:00Z"),
      courseId: 1,
      courseName: "Register Progress Fixture Course",
      day: "Monday",
      startTime: "09:00",
      endTime: "10:00",
      staffName: "Fixture Register Staff",
      registerStatus: "draft",
    },
    {
      scheduleId: 101,
      date: "2026-09-01",
      action: "saved_draft",
      details: `Saved draft with 1 learner mark: Fixture Learner One present; ${privateNote}`,
      createdAt: new Date("2026-09-01T09:10:00Z"),
      courseId: 1,
      courseName: "Register Progress Fixture Course",
      day: "Monday",
      startTime: "09:00",
      endTime: "10:00",
      staffName: "Fixture Register Staff",
      registerStatus: "draft",
    },
    {
      scheduleId: 102,
      date: "2026-09-02",
      action: "saved_draft",
      details: `Saved draft with 1 learner mark: Fixture Learner Two absent; ${privateNote}`,
      createdAt: new Date("2026-09-02T10:05:00Z"),
      courseId: 1,
      courseName: "Register Progress Fixture Course",
      day: "Tuesday",
      startTime: "10:00",
      endTime: "11:00",
      staffName: "Fixture Register Staff",
      registerStatus: "draft",
    },
    {
      scheduleId: 102,
      date: "2026-09-02",
      action: "saved_draft",
      details: `Saved draft with 3 learner marks: Fixture Learner Two absent; ${privateNote}`,
      createdAt: new Date("2026-09-02T10:10:00Z"),
      courseId: 1,
      courseName: "Register Progress Fixture Course",
      day: "Tuesday",
      startTime: "10:00",
      endTime: "11:00",
      staffName: "Fixture Register Staff",
      registerStatus: "draft",
    },
    {
      scheduleId: 103,
      date: "2026-09-03",
      action: "saved_draft",
      details: `Saved draft with 1 learner mark: Fixture Learner Three late; ${privateNote}`,
      createdAt: new Date("2026-09-03T11:05:00Z"),
      courseId: 1,
      courseName: "Register Progress Fixture Course",
      day: "Wednesday",
      startTime: "11:00",
      endTime: "12:00",
      staffName: "Fixture Register Staff",
      registerStatus: "submitted",
    },
    {
      scheduleId: 103,
      date: "2026-09-03",
      action: "submitted",
      details: `Submitted 3 learner marks: Fixture Learner Three late; ${privateNote}`,
      createdAt: new Date("2026-09-03T12:00:00Z"),
      courseId: 1,
      courseName: "Register Progress Fixture Course",
      day: "Wednesday",
      startTime: "11:00",
      endTime: "12:00",
      staffName: "Fixture Register Staff",
      registerStatus: "submitted",
    },
  ];
  const enrollments = [
    { courseId: 1, studentId: 11 },
    { courseId: 1, studentId: 12 },
    { courseId: 1, studentId: 13 },
  ];

  const report = buildRegisterProgressData(baseEvents, enrollments, {});
  assert.equal(report.rows.length, 3);
  assert.deepEqual(report.rows.map(row => row.slice(0, 6)), [
      [
        "Register Progress Fixture Course",
        "2026-09-01",
        "Monday 09:00–10:00",
        "Fixture Register Staff",
        "Draft saved",
        "Unmarked rows",
      ],
      [
        "Register Progress Fixture Course",
        "2026-09-02",
        "Tuesday 10:00–11:00",
        "Fixture Register Staff",
        "Draft saved",
        "Fully marked",
      ],
      [
        "Register Progress Fixture Course",
        "2026-09-03",
        "Wednesday 11:00–12:00",
        "Fixture Register Staff",
        "Final submitted",
        "Fully marked",
      ],
  ]);
  assert.deepEqual(report.rows.map(row => row[6]), [
    "2026-09-01T09:10:00.000Z",
    "2026-09-02T10:10:00.000Z",
    "2026-09-03T12:00:00.000Z",
  ]);

  assert.deepEqual(
    buildRegisterProgressData(baseEvents, enrollments, { status: "Draft" }).rows.map(row => row[1]),
    ["2026-09-01", "2026-09-02"],
  );
  assert.deepEqual(
    buildRegisterProgressData(baseEvents, enrollments, { status: "Submitted" }).rows.map(row => row[1]),
    ["2026-09-03"],
  );
  assert.deepEqual(
    buildRegisterProgressData(baseEvents, enrollments, { completion: "Unmarked rows" }).rows.map(row => row[1]),
    ["2026-09-01"],
  );
  assert.deepEqual(
    buildRegisterProgressData(baseEvents, enrollments, { completion: "Fully marked" }).rows.map(row => row[1]),
    ["2026-09-02", "2026-09-03"],
  );

  const reportText = JSON.stringify(report);
  for (const privateValue of [
    "Fixture Learner One",
    "Fixture Learner Two",
    "Fixture Learner Three",
    "present",
    "absent",
    "late",
    privateNote,
  ]) {
    assert.equal(reportText.includes(privateValue), false, `${privateValue} must not appear in report output`);
  }
});