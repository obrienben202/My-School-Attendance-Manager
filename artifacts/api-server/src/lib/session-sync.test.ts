import assert from "node:assert/strict";
import test from "node:test";
import { parseSessionSheet, reconcileSessions, SESSION_SHEET_TAB, type ExistingSession } from "./session-sync";
import { TECHNOLOGY_TIMETABLE_SOURCE } from "./timetable-sync";
import { refreshSessionSheet } from "./session-sync-stage";
import { fetchSheet } from "./sheet-reader";
import { buildMyTimetable } from "./my-timetable";
import { attendanceDateMatchesScheduleDay } from "./schedule-day";

export const headers = ["id", "code", "Day", "Start Time", "End Time", "Week Pattern"];
export const courses = [
  { id: 18, sourceId: "8", code: "Y10-DT-G1", room: "Lab", staffName: "Mr Fixture Teacher" },
  { id: 20, sourceId: "10", code: "Y11-DT-G1", room: "Room 2", staffName: "Ms Other Teacher" },
  { id: 11, sourceId: "1", code: "Y7-IT-G1", room: null, staffName: "Mr Fixture Teacher" },
];
export const screenshotRows = [
  headers,
  ["8", "Y10-DT-G1", "Monday", "09:00", "10:45", "Every Week"],
  ["10", "Y11-DT-G1", "Monday", "11:05", "12:45", "Every Week"],
  ["1", "Y7-IT-G1", "Monday", "13:35", "14:25", "Every Week"],
];
const parsed = () => parseSessionSheet(screenshotRows, courses).slots;
const existing = (): ExistingSession[] => parsed().map((s, i) => ({ ...s, id: i + 1 }));

test("screenshot times, source IDs, staff and rooms are authoritative; weekly visibility stays scoped", () => {
  const result = parseSessionSheet(screenshotRows, courses);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.slots.map(s => [s.courseId, s.day, s.startTime, s.endTime, s.weekPattern]), [
    [18, "Monday", "09:00", "10:45", "Every week"],
    [20, "Monday", "11:05", "12:45", "Every week"],
    [11, "Monday", "13:35", "14:25", "Every week"],
  ]);
  const timetable = buildMyTimetable(result.slots.map((s, i) => ({
    ...s, id: i + 1, scheduleStaffName: s.staffName, courseStaffName: s.staffName,
    courseCode: "fixture", courseName: "fixture",
  })), [], "Fixture Teacher", "staff");
  assert.equal(timetable.length, 2);
  assert.equal(timetable[0].startTime, "09:00");
  assert.ok(attendanceDateMatchesScheduleDay(new Date("2026-09-28T00:00:00Z"), "Monday"));
  assert.ok(!attendanceDateMatchesScheduleDay(new Date("2026-09-29T00:00:00Z"), "Monday"));
});

test("multiple weekdays and Week A/B retain separate lessons; row order and repeat are deterministic", () => {
  const rows = [...screenshotRows,
    ["8", "Y10-DT-G1", "Wednesday", "09:00", "10:45", "Week A"],
    ["8", "Y10-DT-G1", "Wednesday", "09:00", "10:45", "Week B"]];
  const slots = parseSessionSheet(rows, courses).slots;
  assert.equal(slots.length, 5);
  const old = slots.map((s, i) => ({ ...s, id: i + 1 }));
  const plan = reconcileSessions([...slots].reverse(), old);
  assert.equal(plan.inserts.length, 0);
  assert.deepEqual(plan.retireIds, []);
  assert.deepEqual(plan.updates.map(s => [s.id, s.slot.sourceKey]),
    reconcileSessions(slots, old).updates.map(s => [s.id, s.slot.sourceKey]));
});

test("time/day edits preserve a sole identity, and do not guess at ambiguous edits", () => {
  const old = existing();
  let slots = parsed();
  slots[0] = { ...slots[0], startTime: "09:15", day: "Tuesday", sourceKey: "edited" };
  assert.equal(reconcileSessions(slots, old).updates.find(u => u.slot.courseId === 18)?.id, 1);
  const ambiguousOld = [old[0], { ...old[0], id: 4, startTime: "11:00", endTime: "12:00" }];
  const ambiguousNew = [{ ...slots[0], day: "Friday" }, { ...slots[0], day: "Thursday", sourceKey: "second" }];
  const plan = reconcileSessions(ambiguousNew, ambiguousOld);
  assert.deepEqual(plan.retireIds, [1, 4]);
  assert.equal(plan.inserts.length, 2);
});

test("authoritative takeover retires older manual and imported slots only for represented courses", () => {
  const old = existing();
  const plan = reconcileSessions([parsed()[0]], [
    { ...old[0], source: TECHNOLOGY_TIMETABLE_SOURCE, startTime: "08:30" },
    { ...old[0], id: 4, source: TECHNOLOGY_TIMETABLE_SOURCE, day: "Wednesday" },
    old[1],
    { ...old[0], id: 5, source: null, sourceKey: null },
    { ...old[0], id: 6, source: "unrelated" },
    { ...old[0], id: 7, isActive: false },
    { ...old[1], id: 8, source: null, sourceKey: null },
    { ...old[0], id: 9, courseId: 0, source: null, sourceKey: null },
  ]);
  assert.equal(plan.updates[0].id, 1);
  assert.deepEqual(plan.retireIds, [4, 5, 6]);
});

test("existing sheet identity wins over a matching manual slot and retired rows are not reused", () => {
  const slot = parsed()[0];
  const sheet = existing()[0];
  const manual = { ...sheet, id: 40, source: null, sourceKey: null };
  const plan = reconcileSessions([slot], [manual, sheet]);
  assert.equal(plan.updates[0].id, sheet.id);
  assert.deepEqual(plan.retireIds, [manual.id]);
  assert.deepEqual(plan.inserts, []);
  assert.deepEqual(reconcileSessions([slot], [{ ...manual, isActive: false }]).inserts, [slot]);
});

test("all nonblank rows and exact headers validate before any schedule writes", async () => {
  const badRows = [
    ["8", "Y11-DT-G1", "Monday", "09:00", "10:45", "Every Week"],
    ["unknown", "Y10-DT-G1", "Monday", "09:00", "10:45", "Every Week"],
    ["8", "Y10-DT-G1", "Saturday", "09:00", "10:45", "Every Week"],
    ["8", "Y10-DT-G1", "Monday", "25:00", "10:45", "Every Week"],
    ["8", "Y10-DT-G1", "Monday", "09:00", "09:00", "Every Week"],
    ["8", "Y10-DT-G1", "Monday", "9:00", "10:45", "Every Week"],
    ["8", "Y10-DT-G1", "Monday", "09:00", "10:45", "Monthly"],
    ["8", "Y10-DT-G1", "Monday", "09:00", "10:45", "Every Week"],
    ["8", "Y10-DT-G1", "Monday", "09:00", "10:45", "every week"],
    ["8", "", "", "", "", ""],
  ];
  const entry = await refreshSessionSheet(async () => [headers, ...badRows], async () => courses, async () => {
    assert.fail("invalid snapshot must never be persisted");
  });
  assert.equal(entry.invalid, 9);
  assert.equal(entry.duplicates, 1);
  assert.equal(entry.unmatched, 3);
  assert.ok(entry.errors.every(e => /Sessions row \d+/.test(e)));
  assert.equal(entry.inserted, 0);
  assert.equal(parseSessionSheet([["wrong"], ...screenshotRows.slice(1)], courses).slots.length, 0);
});

test("missing tab, fetch outage, malformed response and empty sheet report failure without writes", async () => {
  for (const response of [
    new Response(JSON.stringify({ error: "missing tab" }), { status: 400 }),
    new Response(JSON.stringify({ values: "malformed" })),
    new Response(JSON.stringify({ values: [] })),
    new Response(JSON.stringify({ values: [headers] })),
    new Response(JSON.stringify(null)),
  ]) {
    const entry = await refreshSessionSheet(
      () => fetchSheet({ proxy: async () => response } as Parameters<typeof fetchSheet>[0], "fixture", SESSION_SHEET_TAB, true),
      async () => courses, async () => { assert.fail("failure must leave schedules untouched"); });
    assert.ok(entry.errors.length);
    assert.equal(entry.inserted + entry.updated + entry.retired, 0);
  }
  const entry = await refreshSessionSheet(async () => { throw new Error("temporary outage"); },
    async () => courses, async () => { assert.fail("outage must not persist"); });
  assert.match(entry.errors[0], /temporary outage/);
  let path = "";
  await fetchSheet({ proxy: async (_slug: string, url: string) => {
    path = url; return new Response(JSON.stringify({ values: screenshotRows }));
  } } as Parameters<typeof fetchSheet>[0], "fixture", SESSION_SHEET_TAB, true);
  assert.match(decodeURIComponent(path), /'Sessions sheet'!A:Z$/);
});

test("successful stage exposes counts; transaction errors are not reported as a refresh", async () => {
  const entry = await refreshSessionSheet(async () => screenshotRows, async () => courses,
    async slots => ({ inserted: slots.length, updated: 0, unchanged: 0, retired: 2 }));
  assert.equal(entry.inserted, 3);
  assert.equal(entry.retired, 2);
  assert.deepEqual(entry.errors, []);
  const failed = await refreshSessionSheet(async () => screenshotRows, async () => courses,
    async () => { throw new Error("transaction rolled back"); });
  assert.equal(failed.inserted, 0);
  assert.match(failed.errors[0], /rolled back/);
});