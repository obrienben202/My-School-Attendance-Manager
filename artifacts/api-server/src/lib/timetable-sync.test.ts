import assert from "node:assert/strict";
import test from "node:test";
import {
  findStaleImportedSlotIds,
  resolveMaintainedTimetable,
  TECHNOLOGY_TIMETABLE_SOURCE,
  type MaintainedTimetableRow,
} from "./timetable-sync";

const teachingRow: MaintainedTimetableRow = {
  slotKey: "mon-ben-3",
  staffName: "Mr Ben O'Brien",
  day: "Monday",
  startLesson: 3,
  endLesson: 4,
  description: "Y11 GCSE Digital Tech G1",
  courseSourceId: "10",
};

test("maps timetable rows to the existing source-backed course identity", () => {
  const result = resolveMaintainedTimetable([teachingRow], [
    { id: 18, sourceId: "10", code: "Y11-DT-G1", room: "IT 1" },
    { id: 99, sourceId: null, code: "C010", room: "Legacy room" },
  ]);

  assert.equal(result.errors.length, 0);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.slots, [{
    courseId: 18,
    day: "Monday",
    startTime: "10:50",
    endTime: "12:50",
    room: "IT 1",
    staffName: "Mr Ben O'Brien",
    weekPattern: "Every week",
    source: TECHNOLOGY_TIMETABLE_SOURCE,
    sourceKey: "mon-ben-3",
  }]);
});

test("falls back to the legacy code without creating a duplicate course", () => {
  const result = resolveMaintainedTimetable([teachingRow], [
    { id: 18, sourceId: null, code: "C010", room: null },
  ]);

  assert.equal(result.slots.length, 1);
  assert.equal(result.slots[0].courseId, 18);
});

test("blank and non-course timetable rows do not create schedule slots", () => {
  const result = resolveMaintainedTimetable([
    { ...teachingRow, slotKey: "blank", description: "", courseSourceId: "10" },
    { ...teachingRow, slotKey: "admin", description: "Admin Work", courseSourceId: null },
  ], [
    { id: 18, sourceId: "10", code: "Y11-DT-G1", room: null },
  ]);

  assert.deepEqual(result.slots, []);
  assert.equal(result.skipped, 2);
  assert.deepEqual(result.errors, []);
});

test("only stale source-owned slots are selected for removal", () => {
  assert.deepEqual(findStaleImportedSlotIds([
    { id: 1, source: TECHNOLOGY_TIMETABLE_SOURCE, sourceKey: "keep" },
    { id: 2, source: TECHNOLOGY_TIMETABLE_SOURCE, sourceKey: "remove" },
    { id: 3, source: null, sourceKey: null },
    { id: 4, source: "another-import", sourceKey: "remove" },
  ], ["keep"]), [2]);
});