import assert from "node:assert/strict";
import test from "node:test";
import {
  hasEmptyRoster,
  hasOnlyEmptyRosters,
  mapScheduleEntryToRegister,
  registerActionLabel,
  registerOccurrencePath,
  registerSummary,
  resolveRegisterListState,
  todayScheduleEntries,
} from "./register-list-state.ts";

test("register list states distinguish loading, failure, assignment, filter, and populated results", () => {
  const state = (overrides: Partial<Parameters<typeof resolveRegisterListState>[0]>) =>
    resolveRegisterListState({
      isLoading: false,
      isError: false,
      assignedCount: 2,
      registerCount: 2,
      filteredCount: 2,
      ...overrides,
    });
  assert.equal(state({ isLoading: true, registerCount: 0 }), "loading");
  assert.equal(state({ isError: true, registerCount: 0 }), "error");
  assert.equal(state({ isLoading: true, isError: true }), "error");
  assert.equal(state({ assignedCount: 0, registerCount: 0 }), "no-assigned-lessons");
  assert.equal(state({ registerCount: 0, filteredCount: 0 }), "no-lessons-today");
  assert.equal(state({ filteredCount: 0 }), "filter-empty");
  assert.equal(state({ filteredCount: 1 }), "ready");
});

test("empty roster guidance is shown only when every assigned register has no learners", () => {
  assert.equal(hasOnlyEmptyRosters([]), false);
  assert.equal(hasOnlyEmptyRosters([{ enrolled: 0 }, { enrolled: 0 }]), true);
  assert.equal(hasOnlyEmptyRosters([{ enrolled: 0 }, { enrolled: 1 }]), false);
  assert.equal(hasEmptyRoster([]), false);
  assert.equal(hasEmptyRoster([{ enrolled: 0 }, { enrolled: 1 }]), true);
  assert.equal(hasEmptyRoster([{ enrolled: 1 }]), false);
});

test("schedule feed entries map to actionable rows with the exact occurrence path", () => {
  const base = {
    id: 72,
    courseId: 8,
    startTime: "10:15",
    endTime: "11:15",
    courseCode: "Y11-DT-G1",
    courseName: "Digital Technology",
    enrolledCount: 0,
    room: "B12",
    staffName: "Ben O'Brien",
    day: "Friday",
    occurrenceDate: "2026-09-25",
    registerMarked: false,
    registerUpdatedAt: null,
    registerSubmittedAt: null,
  };

  const open = mapScheduleEntryToRegister({ ...base, registerStatus: "open" });
  const saved = mapScheduleEntryToRegister({ ...base, registerStatus: "draft" });
  const submitted = mapScheduleEntryToRegister({ ...base, registerStatus: "submitted" });

  assert.deepEqual(
    [open.status, saved.status, submitted.status],
    ["Open", "Saved", "Submitted"],
  );
  assert.equal(open.enrolled, 0);
  assert.equal(open.description, "Y11-DT-G1 — Digital Technology");
  assert.equal(open.date, "2026-09-25");
  assert.equal(open.day, "Friday");
  assert.equal(open.startTime, "10:15");
  assert.equal(open.endTime, "11:15");
  assert.equal(open.room, "B12");
  assert.equal(registerActionLabel(open.status), "Mark Register");
  assert.equal(registerActionLabel(saved.status), "Mark Register");
  assert.equal(registerActionLabel(submitted.status), "Edit Attendance");
  assert.equal(registerOccurrencePath(open.id, open.date), "/registers/72?date=2026-09-25");
  const rows = [open, saved, submitted];
  assert.deepEqual(registerSummary(rows, "ready"), { Open: 1, Saved: 1, Submitted: 1 });
  assert.deepEqual(registerSummary(rows, "error"), { Open: null, Saved: null, Submitted: null });
  assert.deepEqual(registerSummary([], "no-assigned-lessons"), { Open: 0, Saved: 0, Submitted: 0 });
});

test("daily list excludes other weekdays, old occurrences, and unknown days before totals or roster checks", () => {
  const base = {
    id: 1, courseId: 1, courseCode: "ENG", courseName: "English",
    startTime: "09:00", endTime: "10:00", enrolledCount: 2,
    room: null, staffName: null, registerMarked: false,
    registerUpdatedAt: null, registerSubmittedAt: null,
  };
  const feed = [
    { ...base, id: 1, day: "Monday", occurrenceDate: "2026-09-28", registerStatus: "open" },
    { ...base, id: 2, day: "Monday", occurrenceDate: "2026-09-28", registerStatus: "draft" },
    { ...base, id: 3, day: "Monday", occurrenceDate: "2026-09-28", registerStatus: "submitted" },
    { ...base, id: 4, day: "Friday", occurrenceDate: "2026-09-25", registerStatus: "submitted", enrolledCount: 0 },
    { ...base, id: 5, day: null, occurrenceDate: "2026-09-28", registerStatus: "open" },
    { ...base, id: 6, day: "Tuesday", occurrenceDate: "2026-09-28", registerStatus: "open" },
    { ...base, id: 7, day: "Monday", occurrenceDate: "2026-09-21", registerStatus: "open" },
  ];
  const monday = todayScheduleEntries(feed, "2026-09-28").map(mapScheduleEntryToRegister);
  assert.deepEqual(monday.map(row => row.id), [1, 2, 3]);
  assert.deepEqual(registerSummary(monday, "ready"), { Open: 1, Saved: 1, Submitted: 1 });
  assert.equal(hasEmptyRoster(monday), false);
  assert.equal(registerOccurrencePath(monday[2].id, monday[2].date), "/registers/3?date=2026-09-28");
  assert.deepEqual(todayScheduleEntries(feed, "2026-09-29"), []);
  assert.equal(todayScheduleEntries(feed, "2026-10-05").length, 0, "old Monday rows are not reused next week");
  const nextMonday = feed.map(entry => ({
    ...entry, occurrenceDate: entry.day === "Monday" ? "2026-10-05" : entry.occurrenceDate,
  }));
  assert.deepEqual(todayScheduleEntries(nextMonday, "2026-10-05").map(row => row.id), [1, 2, 3, 7]);
});