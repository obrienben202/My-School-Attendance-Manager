import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseCourseReconciliation,
  findStaleCourseIds,
  parseCourseSheetRows,
  type CourseSourceRecord,
} from "./course-sync";

const header = [["id", "code", "name", "room", "staff_name", "head_of_deprment", "year_group", "enrolled_count"]];

test("maps the sheet's real course code and maintained fields", () => {
  const result = parseCourseSheetRows([
    ...header,
    ["7", "Y10-IT-G1", "Year 10 IT", "IT - ", "Mr Ben OBrien", "Mrs Ana OConnor", "Year 10", "24"],
  ]);

  assert.deepEqual(result.records, [{
    sourceId: "7",
    code: "Y10-IT-G1",
    name: "Year 10 IT",
    room: "IT -",
    staffName: "Mr Ben O'Brien",
    headOfDepartment: "Mrs Ana O'Connor",
    yearGroup: "Year 10",
    enrolledCount: 24,
  }]);
  assert.equal(result.skipped, 0);
});

test("prefers a legacy generated-code record so its stable id is preserved", () => {
  const record: CourseSourceRecord = {
    sourceId: "7",
    code: "Y10-IT-G1",
    name: "Year 10 IT",
    room: null,
    staffName: null,
    headOfDepartment: null,
    yearGroup: "Year 10",
    enrolledCount: 24,
  };

  assert.deepEqual(
    chooseCourseReconciliation(record, [
      { id: 15, code: "C007", sourceId: null },
      { id: 90, code: "Y10-IT-G1", sourceId: null },
    ]),
    { targetId: 15, duplicateIds: [90] },
  );
});

test("skips blank spreadsheet rows even when a copied enrolment formula remains", () => {
  const result = parseCourseSheetRows([...header, ["60", "", "", "", "", "", "", "24"]]);
  assert.equal(result.records.length, 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.errors, []);
});

test("flags malformed populated rows so the authoritative sync can abort safely", () => {
  const result = parseCourseSheetRows([
    ...header,
    ["7", "Y10-IT-G1", "Year 10 IT", "IT -", "", "", "Year 10", "not-a-number"],
  ]);
  assert.equal(result.records.length, 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.errors, ["Course sheet row 2 has an invalid enrolment count"]);
});

test("identifies source-absent courses for retirement", () => {
  assert.deepEqual(findStaleCourseIds([9, 10, 11, 68], [9, 10, 11]), [68]);
});