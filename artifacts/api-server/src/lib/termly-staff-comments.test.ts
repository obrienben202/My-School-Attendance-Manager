import assert from "node:assert/strict";
import test from "node:test";
import { canAddStaffComment, staffCommentsFromHistory } from "./termly-staff-comments";

test("all school staff roles can comment but learner and unknown roles cannot", () => {
  for (const role of ["admin", "hod", "staff", "office"]) assert.equal(canAddStaffComment(role), true);
  for (const role of ["learner", "", "guest", "administrator"]) assert.equal(canAddStaffComment(role), false);
});

test("staff-wide comment projection excludes private teacher review history", () => {
  const at = "2026-10-02T12:00:00.000Z";
  const events = [
    { action: "save", actorId: "learner", at },
    { action: "comment", actorId: "rg-teacher", at, comment: "Private RG teacher feedback" },
    { action: "complete", actorId: "rg-teacher", at, comment: "Private completed review" },
    { action: "staff_comment", actorId: "staff-a", at, comment: "Staff observation" },
    { action: "staff_comment", actorId: "retired-staff", at, comment: "Earlier observation" },
    { action: "staff_comment", actorId: "staff-a", at, comment: " " },
  ];
  const result = staffCommentsFromHistory(events, new Map([["staff-a", "Test Teacher"]]));
  assert.deepEqual(result, [
    { actorId: "staff-a", authorName: "Test Teacher", createdAt: at, text: "Staff observation" },
    { actorId: "retired-staff", authorName: "Former staff member", createdAt: at, text: "Earlier observation" },
  ]);
  assert.equal(JSON.stringify(result).includes("Private"), false);
});