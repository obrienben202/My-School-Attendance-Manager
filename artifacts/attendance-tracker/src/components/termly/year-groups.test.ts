import assert from "node:assert/strict";
import test from "node:test";
import { ILP_YEAR_GROUPS, canonicalYearGroup, matchesYearGroup } from "./year-groups.ts";

test("year group choices cover Year 7 through Year 11 only", () => {
  assert.deepEqual(ILP_YEAR_GROUPS, ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11"]);
});

test("year filters handle stored year labels without mixing year groups", () => {
  for (const value of ["7", "Year 7", "Y7", "yr 7", " year 7 "]) assert.equal(matchesYearGroup(value, "Year 7"), true);
  for (const value of ["Year 8", "17", "Year 12", null, undefined]) assert.equal(matchesYearGroup(value, "Year 7"), false);
  assert.equal(matchesYearGroup(null, ""), true);
  assert.equal(canonicalYearGroup("11"), "Year 11");
});