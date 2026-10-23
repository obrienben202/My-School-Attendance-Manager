import type { TermlyIlpTemplate, TermlyIlpTerm } from "@workspace/api-client-react";

export function termlyForms(templates: TermlyIlpTemplate[]) {
  return templates.filter(template => [1, 2, 3].includes(template.term))
    .sort((a, b) => a.term - b.term || b.version - a.version);
}

export function templateEditorLink(id?: number) {
  return `/ilp-admin/termly?tab=Templates${id === undefined ? "" : `&templateId=${id}`}`;
}

export function formAcademicYears(templateId: number, terms: TermlyIlpTerm[]) {
  return [...new Set(terms.filter(term => term.templateId === templateId).map(term => term.academicYear))].sort();
}