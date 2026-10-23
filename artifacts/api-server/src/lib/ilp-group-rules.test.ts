import { test } from "node:test";
import assert from "node:assert/strict";
import { groupMatchesYear } from "./ilp-group-rules";
test("group filters evaluate real roster years, AND filters, and never count missing/out-of-scope years", () => {
  const filter = { field: "Year Group" as const, operator: "equals" as const, value: "Year 7" };
  assert.equal(groupMatchesYear([filter], "7"), true);
  assert.equal(groupMatchesYear([filter], " Year 7 "), true);
  assert.equal(groupMatchesYear([filter], "Year 8"), false);
  assert.equal(groupMatchesYear([filter, { ...filter, value: "Year 8" }], "7"), false);
  assert.equal(groupMatchesYear([{ ...filter, operator: "is not" }], "8"), true);
  assert.equal(groupMatchesYear([{ ...filter, operator: "is not" }], null), false);
  assert.equal(groupMatchesYear([], "Year 12"), false);
  assert.equal(groupMatchesYear([], "Year 11"), true);
});