import type { ReviewTemplateContent, ReviewWork } from "@workspace/db";

export const DISCUSS_RESPONSE = "Discuss with my RG teacher";
export const TUTOR_ROLES = ["staff", "hod", "admin"];
export function calendarDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validAcademicYear(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{4}$/.test(value)) return false;
  const [first, last] = value.split("-").map(Number);
  return last === first + 1;
}
export function validateTemplate(content: ReviewTemplateContent): string[] {
  const errors: string[] = [];
  if (!content.title.trim() || !content.welcome.trim() || !content.instructions.trim() || !content.endGuidance.trim()) errors.push("Title, welcome, instructions and end guidance are required.");
  if (!content.sections.length || content.sections.length > 30) errors.push("Include between 1 and 30 sections.");
  const ids = new Set<string>();
  let count = 0;
  for (const section of content.sections) {
    if (!section.title.trim() || !section.questions.length) errors.push("Every section needs a title and questions.");
    for (const item of [section, ...section.questions]) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id)) errors.push("Section and question identities must be unique.");
      ids.add(item.id);
    }
    for (const q of section.questions) {
      count++;
      if (!q.prompt.trim() || q.prompt.length > 2000) errors.push("Question text must be 1–2000 characters.");
    }
  }
  if (count > 100) errors.push("A template may contain at most 100 questions.");
  return errors;
}
export function validateWork(work: ReviewWork, template: ReviewTemplateContent, submit: boolean): string[] {
  const errors: string[] = [];
  const questions = template.sections.flatMap(s => s.questions);
  const allowed = new Set(questions.map(q => q.id));
  if (Object.keys(work.answers).some(id => !allowed.has(id))) errors.push("An answer references an unknown question.");
  if (Object.values(work.answers).some(value => typeof value !== "string" || value.length > 10000)) errors.push("Answers must be text of at most 10000 characters.");
  if (work.summary.length > 10000 || Object.keys(work.priorTargetUpdates).length > 100) errors.push("Summary or target updates exceed the permitted size.");
  const categories = new Set(work.targets.map(t => t.category));
  if (work.targets.length > 3 || categories.size !== work.targets.length) errors.push("Use one target per category.");
  if (work.targets.some(t => [t.description, t.steps, t.progress].some(v => v.length > 10000))) errors.push("Target text exceeds the permitted size.");
  if (submit) {
    for (const question of questions) {
      if (question.required && !work.answers[question.id]?.trim()) errors.push(`Answer required: ${question.prompt} You can select '${DISCUSS_RESPONSE}'.`);
    }
    if (!work.summary.trim()) errors.push("Add a Summary of Discussion, or indicate you will discuss it with your RG teacher.");
    for (const category of ["academic", "personal", "future"]) {
      const target = work.targets.find(t => t.category === category);
      if (!target?.description.trim() || !target.steps.trim()) errors.push(`Add the ${category} target and actionable steps.`);
    }
  }
  return errors;
}
export function reviewActionAllowed(role: string, status: string, action: string): boolean {
  if (role === "learner") return ["not_started", "draft", "returned"].includes(status) && ["save", "submit"].includes(action);
  return TUTOR_ROLES.includes(role) && status === "submitted" && ["comment", "complete", "return"].includes(action);
}