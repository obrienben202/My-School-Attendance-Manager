import assert from "node:assert/strict";
import test from "node:test";
import { canAccessSafeguarding } from "./safeguarding-access";

test("allows staff and heads of department to access safeguarding notes", () => {
  assert.equal(canAccessSafeguarding({ role: "staff" }), true);
  assert.equal(canAccessSafeguarding({ role: "hod" }), true);
});

test("denies unauthenticated, office, and administrator identities", () => {
  assert.equal(canAccessSafeguarding(undefined), false);
  assert.equal(canAccessSafeguarding({ role: "office" }), false);
  assert.equal(canAccessSafeguarding({ role: "admin" }), false);
});