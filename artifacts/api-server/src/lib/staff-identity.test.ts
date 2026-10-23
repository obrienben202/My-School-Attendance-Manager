import assert from "node:assert/strict";
import test from "node:test";
import { normaliseStaffName, staffNameKey, staffNamesMatch } from "./staff-identity";

test("normalises titles, whitespace, case and curly apostrophes", () => {
  assert.equal(normaliseStaffName("  Mr Ben O’Brien  "), "ben obrien");
  assert.equal(normaliseStaffName("DR.  HELEN   CARTER"), "helen carter");
});

test("matches an apostrophe-less timetable surname to the staff directory spelling", () => {
  assert.equal(staffNamesMatch("Mr Ben OBrien", "Ben O'Brien"), true);
  assert.equal(staffNamesMatch("Mrs Ana OConnor", "Ana O’Connor"), true);
});

test("builds stable name keys from equivalent staff names", () => {
  assert.equal(staffNameKey("Ms Helen Carter"), staffNameKey("helen carter"));
});

test("matches valid staff references without matching missing names", () => {
  assert.equal(staffNamesMatch("Mrs Claire Adams", "Claire Adams"), true);
  assert.equal(staffNamesMatch(null, "Claire Adams"), false);
  assert.equal(staffNamesMatch("", ""), false);
  assert.equal(staffNamesMatch("Ann Smith", "Anna Smith"), false);
  assert.equal(staffNamesMatch("John Smith", "John Smithson"), false);
});