export type PlannedAbsenceDraft = {
  dateType: "single" | "range" | "mixed";
  singleDate: string;
  rangeFrom: string;
  rangeTo: string;
  partDay: boolean;
  startTime: string;
  endTime: string;
};

export function validatePlannedAbsenceDraft(
  draft: PlannedAbsenceDraft,
  today: string,
): string {
  if (draft.dateType === "mixed") return "Record mixed periods as separate requests.";
  const fromDate = draft.dateType === "single" ? draft.singleDate : draft.rangeFrom;
  const toDate = draft.dateType === "single" ? draft.singleDate : draft.rangeTo;
  if (!fromDate || !toDate) return "Start and end dates are required.";
  if (fromDate < today) return "Planned absences must start today or later.";
  if (fromDate > toDate) return "The end date must be on or after the start date.";
  if (draft.partDay && (!draft.startTime || !draft.endTime || draft.startTime >= draft.endTime)) {
    return "Enter a start time before the end time.";
  }
  return "";
}

export function plannedAbsenceErrorMessage(error: unknown) {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  return typeof data?.error === "string"
    ? data.error
    : "The request could not be saved. Check your connection and try again.";
}