import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessSafeguardingAtRiskReport,
  canAccessSafeguardingNotes,
} from "./safeguarding-access";

test("allows admins, staff, and heads of department to access protected safeguarding notes", () => {
  assert.equal(canAccessSafeguardingNotes({ role: "admin" }), true);
  assert.equal(canAccessSafeguardingNotes({ role: "staff" }), true);
  assert.equal(canAccessSafeguardingNotes({ role: "hod" }), true);
});

test("denies unauthenticated and office identities for protected notes", () => {
  assert.equal(canAccessSafeguardingNotes(undefined), false);
  assert.equal(canAccessSafeguardingNotes({ role: "office" }), false);
});

test("safeguarding at-risk reports remain limited to staff and heads of department", () => {
  assert.equal(canAccessSafeguardingAtRiskReport({ role: "staff" }), true);
  assert.equal(canAccessSafeguardingAtRiskReport({ role: "hod" }), true);
  assert.equal(canAccessSafeguardingAtRiskReport({ role: "admin" }), false);
  assert.equal(canAccessSafeguardingAtRiskReport({ role: "office" }), false);
  assert.equal(canAccessSafeguardingAtRiskReport(undefined), false);
});