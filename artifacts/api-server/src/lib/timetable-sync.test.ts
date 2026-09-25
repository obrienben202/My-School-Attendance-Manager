import assert from "node:assert/strict";
import test from "node:test";
import {
  findStaleImportedSlotIds,
  resolveMaintainedTimetable,
  TECHNOLOGY_STAFF_TIMETABLE,
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

test("normalizes recognized teaching weekdays before importing", () => {
  const result = resolveMaintainedTimetable([
    { ...teachingRow, day: "  mOnDaY  " },
    { ...teachingRow, slotKey: "tue-ben-3", day: "TUESDAY" },
    { ...teachingRow, slotKey: "wed-ben-3", day: "Wednesday" },
    { ...teachingRow, slotKey: "thu-ben-3", day: "Thursday" },
    { ...teachingRow, slotKey: "fri-ben-3", day: "Friday" },
  ], [{ id: 18, sourceId: "10", code: "Y11-DT-G1", room: null }]);

  assert.deepEqual(result.slots.map(slot => slot.day), ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  assert.deepEqual(result.invalidDayErrors, []);
  assert.deepEqual(result.errors, []);
});

test("the maintained timetable still resolves its teaching slots with valid weekdays", () => {
  const sourceIds = [...new Set(TECHNOLOGY_STAFF_TIMETABLE.map(row => row.courseSourceId).filter(id => id !== null))];
  const courses = sourceIds.map((sourceId, index) => ({
    id: index + 1, sourceId, code: `COURSE-${sourceId}`, room: null,
  }));
  const result = resolveMaintainedTimetable(TECHNOLOGY_STAFF_TIMETABLE, courses);

  assert.deepEqual(result.errors, []);
  assert.equal(result.slots.length, TECHNOLOGY_STAFF_TIMETABLE.filter(row => row.courseSourceId !== null).length);
});

test("populated teaching rows with blank or unknown weekdays produce actionable errors and no slots", () => {
  const result = resolveMaintainedTimetable([
    { ...teachingRow, slotKey: "blank-day", day: "   " },
    { ...teachingRow, slotKey: "unknown-day", day: "Funday" },
    { ...teachingRow, slotKey: "weekend-day", day: "Saturday" },
  ], [{ id: 18, sourceId: "10", code: "Y11-DT-G1", room: null }]);

  assert.deepEqual(result.slots, []);
  assert.equal(result.invalidDayErrors.length, 3);
  assert.deepEqual(result.errors, result.invalidDayErrors);
  for (const key of ["blank-day", "unknown-day", "weekend-day"]) {
    assert.ok(result.invalidDayErrors.some(error => error.includes(key) && error.includes("use Monday")));
  }
});

test("missing weekday on a populated teaching row is rejected", () => {
  const result = resolveMaintainedTimetable([
    { ...teachingRow, day: undefined as unknown as string },
  ], [{ id: 18, sourceId: "10", code: "Y11-DT-G1", room: null }]);

  assert.deepEqual(result.slots, []);
  assert.match(result.invalidDayErrors[0], /mon-ben-3: invalid weekday null/);
});

test("blank and non-course timetable rows do not create schedule slots", () => {
  const result = resolveMaintainedTimetable([
    { ...teachingRow, slotKey: "blank", description: "", courseSourceId: "10" },
    { ...teachingRow, slotKey: "admin", description: "Admin Work", courseSourceId: null, day: "" },
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