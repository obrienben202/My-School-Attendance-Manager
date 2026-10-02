import assert from "node:assert/strict";
import test from "node:test";
import type { TermlyIlpTemplate, TermlyIlpTerm } from "@workspace/api-client-react";
import { formAcademicYears, templateEditorLink, termlyForms } from "./form-associations.ts";

function template(id: number, term: number, version = 1): TermlyIlpTemplate {
  return { id, term, version, revision: 0, status: "draft", content: {
    title: `Term ${term} ILP`, welcome: "Welcome", instructions: "", endGuidance: "",
    targetExamples: { academic: "", personal: "", future: "" }, sections: [],
  } };
}

test("associations include all real Term 1–3 forms and preserve earlier versions", () => {
  const input = [template(3, 3), template(1, 1), template(5, 4), template(2, 2), template(4, 1, 2)];
  assert.deepEqual(termlyForms(input).map(form => form.id), [4, 1, 2, 3]);
  assert.deepEqual(input.map(form => form.id), [3, 1, 5, 2, 4]);
  assert.deepEqual(termlyForms([]), []);
});

test("form links open the exact saved template instead of a mock header", () => {
  assert.equal(templateEditorLink(12), "/ilp-admin/termly?tab=Templates&templateId=12");
  assert.equal(templateEditorLink(), "/ilp-admin/termly?tab=Templates");
});

test("academic years are derived from published terms using the same form version", () => {
  const term = (id: number, templateId: number, academicYear: string): TermlyIlpTerm => ({
    id, templateId, academicYear, term: 1, startDate: "2026-09-01", endDate: "2027-01-01", deadline: "2026-12-01",
  });
  assert.deepEqual(formAcademicYears(12, [
    term(1, 12, "2026-2027"), term(2, 99, "2025-2026"), term(3, 12, "2026-2027"), term(4, 12, "2027-2028"),
  ]), ["2026-2027", "2027-2028"]);
  assert.deepEqual(formAcademicYears(0, []), []);
});