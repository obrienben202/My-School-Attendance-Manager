import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyTimetable, sessionTime, timetableDays, timetablePeriods } from "./my-timetable-presentation.ts";
import { timetablePrintDocument } from "./my-timetable-print.ts";
import type { PersonalSlot } from "./my-timetable-query.ts";

const slot = (overrides: Partial<PersonalSlot> = {}): PersonalSlot => ({
  id: 1, day: "Monday", startTime: "09:00", endTime: "09:55",
  description: "Computing", groupLabel: "Year 7", room: "G1", weekPattern: "Week A", ...overrides,
});

test("reference days and period times are fixed, and an empty schedule keeps blank lesson cells", () => {
  const model = buildWeeklyTimetable([]);
  assert.deepEqual(timetableDays, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  assert.deepEqual(timetablePeriods.map(p => [p.start, p.end]), [
    ["08:45", "09:00"], ["09:00", "09:55"], ["09:55", "10:45"],
    ["10:45", "11:05"], ["11:05", "11:55"], ["11:55", "12:45"],
    ["12:45", "13:25"], ["13:25", "14:25"], ["14:25", "15:30"],
  ]);
  assert.equal(model.rows.length, 9);
  assert.equal(model.rows.flatMap(row => row.cells.flat()).length, 0);
  assert.deepEqual(model.additional, []);
});

test("ordinary sessions use their weekday and actual lesson area with no invented assignments", () => {
  const original = slot({ day: "Friday", startTime: "14:30", endTime: "15:30" });
  const model = buildWeeklyTimetable([original]);
  assert.equal(model.rows[8].cells[4][0].slot, original);
  assert.equal(model.rows.flatMap(row => row.cells.flat()).length, 1);
  assert.equal(model.additional.length, 0);
  assert.equal(sessionTime(original), "14:30–15:30");
});

test("cross-period and overlapping records remain separate and keep full times, including duplicate IDs", () => {
  const first = slot({ startTime: "09:30", endTime: "10:30" });
  const second = slot({ description: "Another record", startTime: "09:40", endTime: "10:00" });
  const model = buildWeeklyTimetable([first, second]);
  for (const row of [model.rows[1], model.rows[2]]) {
    assert.deepEqual(row.cells[0].map(entry => entry.sourceIndex), [0, 1]);
    assert.ok(row.cells[0].every(entry => entry.crossPeriod));
    assert.equal(sessionTime(row.cells[0][0].slot), "09:30–10:30");
  }
});

test("early, registration, break, lunch, beyond-hours, missing/invalid times and unknown days remain visible", () => {
  const inputs = [
    slot({ startTime: "08:30", endTime: "09:30" }),
    slot({ startTime: "08:45", endTime: "09:00" }),
    slot({ startTime: "10:45", endTime: "11:05" }),
    slot({ startTime: "12:30", endTime: "13:40" }),
    slot({ startTime: "15:00", endTime: "16:00" }),
    slot({ startTime: null }),
    slot({ endTime: null }),
    slot({ startTime: "25:00" }),
    slot({ startTime: "09:55", endTime: "09:00" }),
    slot({ day: "Saturday" }),
    slot({ day: "Unscheduled" }),
    slot({ startTime: "09:00", endTime: "09:00" }),
  ];
  const model = buildWeeklyTimetable(inputs);
  assert.deepEqual(model.additional.map(entry => entry.slot), inputs);
  assert.ok(model.additional.every(entry => entry.reason));
  assert.equal(model.rows.flatMap(row => row.cells.flat()).length, 0);
  assert.equal(sessionTime(inputs[5]), "Time not recorded–09:55");
});

test("lesson boundaries do not accidentally classify adjacent breaks as overlaps", () => {
  const model = buildWeeklyTimetable([
    slot({ startTime: "09:55", endTime: "10:45" }),
    slot({ startTime: "11:05", endTime: "12:45" }),
    slot({ startTime: "13:25", endTime: "15:30" }),
  ]);
  assert.equal(model.additional.length, 0);
  assert.equal(model.rows[2].cells[0].length, 1);
  assert.equal(model.rows[4].cells[0].length, 1);
  assert.equal(model.rows[5].cells[0].length, 1);
  assert.equal(model.rows[7].cells[0].length, 1);
  assert.equal(model.rows[8].cells[0].length, 1);
});

test("every source record is represented regardless of overlap or input order and input is not mutated", () => {
  const inputs = Object.freeze([
    Object.freeze(slot({ startTime: "11:30", endTime: "12:30" })),
    Object.freeze(slot({ startTime: "11:05", endTime: "11:55" })),
    Object.freeze(slot({ day: "", endTime: null })),
  ]);
  const model = buildWeeklyTimetable(inputs);
  const indices = new Set([...model.rows.flatMap(row => row.cells.flat()).map(e => e.sourceIndex), ...model.additional.map(e => e.sourceIndex)]);
  assert.deepEqual([...indices].sort(), [0, 1, 2]);
  assert.deepEqual(model.rows[4].cells[0].map(e => e.sourceIndex), [1, 0]);
});

test("printing uses the same grid, bands, full actual times, extra records and escaped metadata", () => {
  const html = timetablePrintDocument('<Staff & "Name">', [
    slot({ description: "<script>bad()</script>", startTime: "09:30", endTime: "10:30", weekPattern: "A & B" }),
    slot({ day: "<Unknown>", startTime: "08:30", endTime: null, room: 'Room "1"' }),
  ]);
  for (const day of timetableDays) assert.ok(html.includes(`>${day}</th>`));
  assert.equal((html.match(/colspan="5"/g) ?? []).length, 3);
  assert.equal((html.match(/09:30–10:30/g) ?? []).length, 2);
  assert.ok(html.includes("Additional / unplaced sessions"));
  assert.ok(html.includes("&lt;Unknown&gt;"));
  assert.ok(html.includes("08:30–Time not recorded"));
  assert.ok(html.includes("A &amp; B"));
  assert.ok(html.includes("Room &quot;1&quot;"));
  assert.ok(html.includes("&lt;Staff &amp; &quot;Name&quot;&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("size:A4 landscape"));
  assert.ok(!html.includes("<button"));
});