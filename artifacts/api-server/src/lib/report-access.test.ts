import assert from "node:assert/strict";
import test from "node:test";
import { canAccessReports } from "./report-access";

test("reports use the same role set as the existing Reports navigation", () => {
  assert.equal(canAccessReports({ role: "admin" }), true);
  assert.equal(canAccessReports({ role: "hod" }), true);
  assert.equal(canAccessReports({ role: "office" }), true);
});

test("unauthenticated and non-report staff cannot access reports", () => {
  assert.equal(canAccessReports(undefined), false);
  assert.equal(canAccessReports({ role: "staff" }), false);
  assert.equal(canAccessReports({ role: "unknown" }), false);
});