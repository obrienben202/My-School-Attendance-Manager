import { test } from "node:test";
import assert from "node:assert/strict";
import { PDF_ILP_TEMPLATES } from "./ilp-pdf-templates";
import { DISCUSS_RESPONSE, calendarDate, validAcademicYear, validateTemplate, validateWork, reviewActionAllowed } from "./termly-ilp-rules";
import { normalizeDirectoryRole } from "./user-directory";
import { resolveCurrentSessionUser } from "./session-user";
import type { ReviewWork } from "@workspace/db";

test("PDF has exactly three terms, 17/18/18 questions and stable unique identities", () => {
  assert.equal(PDF_ILP_TEMPLATES.length, 3);
  assert.deepEqual(PDF_ILP_TEMPLATES.map(t => t.sections.flatMap(s => s.questions).length), [17, 18, 18]);
  assert.deepEqual(PDF_ILP_TEMPLATES.map(t => t.sections.map(s => s.title)), [
    ["General Questions", "Personal Development", "Future Aspirations", "Academic Progress"],
    ["Reflection", "Overcoming Barriers", "Future Aspirations", "Celebrating Success", "Academic Progress"],
    ["Reflection", "Academic Progress", "Future Aspirations", "Celebrating Your Success"],
  ]);
  for (const template of PDF_ILP_TEMPLATES) {
    assert.deepEqual(validateTemplate(template), []);
    assert.match(template.welcome, /private/);
    assert.match(template.endGuidance, /Submit to Tutor/);
    assert.ok(Object.values(template.targetExamples).every(v => v.length > 10));
  }
});
test("unfinished work can save; required questions accept explicit discussion without teacher comment", () => {
  const template = PDF_ILP_TEMPLATES[0];
  const work: ReviewWork = { answers: {}, summary: "", targets: [], priorTargetUpdates: {} };
  assert.deepEqual(validateWork(work, template, false), []);
  assert.equal(validateWork(work, template, true).filter(e => e.startsWith("Answer required")).length, 17);
  work.answers = Object.fromEntries(template.sections.flatMap(s => s.questions).map(q => [q.id, DISCUSS_RESPONSE]));
  work.summary = DISCUSS_RESPONSE;
  work.targets = (["academic", "personal", "future"] as const).map(category => ({ category, description: DISCUSS_RESPONSE, steps: "Meet my RG teacher to agree the next step.", progress: "", completed: false }));
  assert.deepEqual(validateWork(work, template, true), []);
  work.answers.otherLearnerQuestion = "tamper";
  assert.match(validateWork(work, template, false).join(), /unknown question/);
});
test("calendar dates and annual rollover are validated without timezone conversion", () => {
  assert.equal(calendarDate("2028-02-29"), true);
  assert.equal(calendarDate("2027-02-29"), false);
  assert.equal(calendarDate("2026-01-01T00:00:00Z"), false);
  assert.equal(validAcademicYear("2026-2027"), true);
  assert.equal(validAcademicYear("2026-2028"), false);
});
test("learner and teacher transitions are separate and fail closed", () => {
  for (const status of ["not_started", "draft", "returned"]) assert.equal(reviewActionAllowed("learner", status, "save"), true);
  for (const status of ["submitted", "reviewed"]) assert.equal(reviewActionAllowed("learner", status, "save"), false);
  assert.equal(reviewActionAllowed("learner", "submitted", "complete"), false);
  assert.equal(reviewActionAllowed("staff", "submitted", "complete"), true);
  assert.equal(reviewActionAllowed("office", "submitted", "complete"), false);
  assert.equal(reviewActionAllowed("staff", "draft", "complete"), false);
  assert.equal(reviewActionAllowed("unknown", "draft", "save"), false);
});
test("directory explicitly accepts student aliases and current sessions reject unknown roles", () => {
  assert.equal(normalizeDirectoryRole("student"), "learner");
  assert.equal(normalizeDirectoryRole("learner"), "learner");
  assert.throws(() => normalizeDirectoryRole("student administrator"));
  const current = { id: "fixture", role: "learner", username: "fixture", email: null, firstName: null, lastName: null, profileImageUrl: null, department: null };
  const session = resolveCurrentSessionUser({ ...current, role: "staff" }, current);
  assert.equal(session?.role, "learner");
  assert.equal(resolveCurrentSessionUser({ ...current, role: "staff" }, { ...current, role: "unknown" }), null);
});