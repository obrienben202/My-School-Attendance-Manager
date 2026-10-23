import assert from "node:assert/strict";
import test from "node:test";
import { buildMyTimetable } from "./my-timetable";

const course = {
  id: 7,
  day: "Tuesday",
  startTime: "09:00",
  endTime: "10:00",
  room: "IT 2",
  weekPattern: "Every week",
  scheduleStaffName: "Mr Ben OBrien",
  courseStaffName: "Someone Else",
  courseName: "Digital Technology",
  courseCode: "DT-1",
};

test("own course schedule is shown even without personal timetable rows", () => {
  assert.deepEqual(buildMyTimetable([course], [], "Ben O'Brien", "staff"), [{
    id: "course-7",
    day: "Tuesday",
    startTime: "09:00",
    endTime: "10:00",
    description: "DT-1 — Digital Technology",
    groupLabel: null,
    room: "IT 2",
    weekPattern: "Every week",
  }]);
});

test("an explicitly assigned teacher takes precedence over the course teacher", () => {
  const someoneElsesSlot = { ...course, scheduleStaffName: "Ms Alice Smith", courseStaffName: "Ben O'Brien" };
  assert.deepEqual(buildMyTimetable([someoneElsesSlot], [], "Ben O'Brien", "staff"), []);
  assert.equal(buildMyTimetable([someoneElsesSlot], [], "Alice Smith", "staff").length, 1);
  assert.deepEqual(buildMyTimetable([{ ...course, scheduleStaffName: null, courseStaffName: "Ben O’Brien" }], [], "Ben O'Brien", "staff").length, 1);
});

test("personal activities match exactly; shared HoD activities are role-scoped", () => {
  const own = { id: 3, staffName: "Mr Ben O’Brien", isHodShared: false, day: "Tuesday", startTime: "10:00", endTime: "11:00", description: "Preparation", groupLabel: null, room: null };
  const other = { ...own, id: 4, staffName: "Ben O'Brien-Smith" };
  const shared = { ...own, id: 5, staffName: null, isHodShared: true, description: "Department meeting" };
  assert.deepEqual(buildMyTimetable([], [own, other, shared], "Ben O'Brien", "staff").map(row => row.id), ["staff-3"]);
  assert.deepEqual(buildMyTimetable([], [own, other, shared], "Ben O'Brien", "hod").map(row => row.id), ["staff-3", "staff-5"]);
  assert.deepEqual(buildMyTimetable([course], [own, shared], "", "staff"), []);
});