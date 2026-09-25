import assert from "node:assert/strict";
import test from "node:test";
import {
  hasEmptyRoster,
  hasOnlyEmptyRosters,
  mapScheduleEntryToRegister,
  registerActionLabel,
  registerOccurrencePath,
  resolveRegisterListState,
} from "./register-list-state.ts";

test("register list states distinguish loading, failure, assignment, filter, and populated results", () => {
  assert.equal(resolveRegisterListState({
    isLoading: true,
    isError: false,
    registerCount: 0,
    filteredCount: 0,
  }), "loading");
  assert.equal(resolveRegisterListState({
    isLoading: false,
    isError: true,
    registerCount: 0,
    filteredCount: 0,
  }), "error");
  assert.equal(resolveRegisterListState({
    isLoading: false,
    isError: false,
    registerCount: 0,
    filteredCount: 0,
  }), "no-assigned-lessons");
  assert.equal(resolveRegisterListState({
    isLoading: false,
    isError: false,
    registerCount: 2,
    filteredCount: 0,
  }), "filter-empty");
  assert.equal(resolveRegisterListState({
    isLoading: false,
    isError: false,
    registerCount: 2,
    filteredCount: 1,
  }), "ready");
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
});