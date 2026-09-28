import assert from "node:assert/strict";
import test from "node:test";
import { displayAccountEmail } from "./profile-display.ts";

test("a failed refetch hides a previously successful directory email", () => {
  const retainedProfileEmail = "verified@school.example";
  assert.equal(displayAccountEmail(null, retainedProfileEmail, false), retainedProfileEmail);
  assert.equal(displayAccountEmail(null, retainedProfileEmail, true), null);
  assert.equal(displayAccountEmail("account@school.example", retainedProfileEmail, true), "account@school.example");
});