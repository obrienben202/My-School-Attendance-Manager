import type { Ilp, IlpSectionState } from "@workspace/api-client-react";

export type IlpSectionProgress = {
  completed: number;
  total: number;
  percent: number;
};

export function getSectionProgress(sections: IlpSectionState[] = []): IlpSectionProgress {
  const completed = sections.filter((section) => section.status === "completed").length;
  return {
    completed,
    total: sections.length,
    percent: sections.length ? Math.round((completed / sections.length) * 100) : 0,
  };
}

export function formatIlpDate(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Intl.DateTimeFormat("en-GB").format(new Date(year, month - 1, day));
}

export function formatIlpStatus(status: Ilp["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getIlpTutorName(tutor?: string | null): string {
  return tutor?.trim() || "Unassigned";
}

export function getSectionProgressLabel(ilp: Pick<Ilp, "sections">): string {
  const progress = getSectionProgress(ilp.sections);
  return progress.total ? `${progress.completed}/${progress.total} complete` : "Not started";
}

export function isIlpOpen(ilp: Pick<Ilp, "status">): boolean {
  return ilp.status !== "completed";
}

export function isTutorOwner(tutor: string | null | undefined, userName: string): boolean {
  const tutorName = tutor?.trim();
  return Boolean(tutorName) && tutorName?.toLowerCase() === userName.trim().toLowerCase();
}

export function getReviewStatus(
  ilp: Pick<Ilp, "status" | "lastReviewDate" | "nextReviewDue">,
  today = new Date(),
): "Overdue" | "In Progress" | "In Review" {
  if (ilp.nextReviewDue) {
    const [year, month, day] = ilp.nextReviewDue.slice(0, 10).split("-").map(Number);
    const dueDate = new Date(year, month - 1, day);
    const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (dueDate < currentDate) return "Overdue";
  }
  return ilp.lastReviewDate ? "In Review" : "In Progress";
}

export function latestIlpByStudent(ilps: Ilp[]): Map<number, Ilp> {
  return ilps.reduce((result, ilp) => {
    const current = result.get(ilp.studentId);
    if (!current || new Date(ilp.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
      result.set(ilp.studentId, ilp);
    }
    return result;
  }, new Map<number, Ilp>());
}