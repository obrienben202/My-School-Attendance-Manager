import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScheduleFeed,
  getLessonOccurrenceDate,
} from "../routes/schedule";

const referenceDate = new Date("2026-09-01T12:00:00.000Z");

function record(overrides: Partial<Parameters<typeof buildScheduleFeed>[0][number]> = {}) {
  return {
    id: 10,
    courseId: 7,
    startTime: "14:30",
    endTime: "15:30",
    room: "B12",
    staffName: "Mr Ben O'Brien",
    day: "Tuesday",
    registerMarked: false,
    courseCode: "Y11-DT-G1",
    courseName: "Year 11 Digital Technology - G1",
    courseStaffName: "Mr Ben O'Brien",
    ...overrides,
  };
}

test("schedule feed preserves roster counts and exact occurrence lifecycle states", () => {
  const feed = buildScheduleFeed(
    [
      record({ id: 10 }),
      record({ id: 11, courseId: 8, courseCode: "Y11-IT-G1", courseName: "IT" }),
      record({ id: 12, courseId: 9, courseCode: "Y10-IT-G1", courseName: "Year 10 IT" }),
    ],
    [
      { courseId: 7, studentId: 101 },
      { courseId: 7, studentId: 102 },
      { courseId: 8, studentId: 103 },
    ],
    [
      {
        scheduleId: 10,
        date: "2026-09-01",
        status: "draft",
        updatedAt: new Date("2026-09-01T15:00:00.000Z"),
        submittedAt: null,
      },
      {
        scheduleId: 11,
        date: "2026-09-01",
        status: "submitted",
        updatedAt: new Date("2026-09-01T16:00:00.000Z"),
        submittedAt: new Date("2026-09-01T16:00:00.000Z"),
      },
    ],
    [
      { scheduleId: 12, date: "2026-09-01" },
      { scheduleId: 10, date: "2026-08-25" },
    ],
    referenceDate,
  );

  assert.deepEqual(
    feed.map(({ id, occurrenceDate, enrolledCount, registerStatus }) => ({
      id,
      occurrenceDate,
      enrolledCount,
      registerStatus,
    })),
    [
      { id: 10, occurrenceDate: "2026-09-01", enrolledCount: 2, registerStatus: "draft" },
      { id: 11, occurrenceDate: "2026-09-01", enrolledCount: 1, registerStatus: "submitted" },
      { id: 12, occurrenceDate: "2026-09-01", enrolledCount: 0, registerStatus: "draft" },
    ],
  );
  assert.equal(feed[1].registerSubmittedAt, "2026-09-01T16:00:00.000Z");
  assert.equal(feed[0].registerSubmittedAt, null);
});

test("schedule feed keeps assigned lessons open when enrolments are empty", () => {
  const [lesson] = buildScheduleFeed(
    [record()],
    [],
    [],
    [],
    referenceDate,
  );

  assert.equal(lesson.enrolledCount, 0);
  assert.equal(lesson.registerStatus, "open");
  assert.equal(lesson.occurrenceDate, "2026-09-01");
});

test("schedule feed ignores legacy attendance from another occurrence", () => {
  const [lesson] = buildScheduleFeed(
    [record()],
    [],
    [],
    [{ scheduleId: 99, date: "2026-09-01" }],
    referenceDate,
  );

  assert.equal(lesson.registerStatus, "open");
});

test("missing timetable days use the reference date without timezone drift", () => {
  assert.equal(getLessonOccurrenceDate(null, referenceDate), "2026-09-01");
});

test("feed occurrence dates follow the school day through Sunday to next Monday", () => {
  const beforeMidnight = new Date("2026-09-27T22:30:00Z");
  const afterMidnight = new Date("2026-09-27T23:30:00Z");
  assert.equal(getLessonOccurrenceDate("Monday", beforeMidnight), "2026-09-21");
  assert.equal(getLessonOccurrenceDate("Monday", afterMidnight), "2026-09-28");
  assert.equal(getLessonOccurrenceDate("Friday", afterMidnight), "2026-09-25");
  assert.equal(getLessonOccurrenceDate("Monday", new Date("2026-10-04T23:30:00Z")), "2026-10-05");
});