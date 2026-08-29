type PlannedAbsenceDates = {
  fromDate: string;
  toDate: string;
  reason: string;
  partDay?: boolean;
  startTime?: string;
  endTime?: string;
};

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function validatePlannedAbsenceInput(
  input: PlannedAbsenceDates,
  today: string,
): string | null {
  if (!input.reason.trim()) return "Learner, dates, and reason are required.";
  if (!isCalendarDate(input.fromDate) || !isCalendarDate(input.toDate)) {
    return "Enter valid absence dates.";
  }
  if (input.fromDate < today || input.fromDate > input.toDate) {
    return "Absence dates must be today or later, with the end date on or after the start date.";
  }
  if (
    input.partDay
    && (
      !input.startTime
      || !input.endTime
      || input.startTime >= input.endTime
      || input.fromDate !== input.toDate
    )
  ) {
    return "Part-day requests require one date and a valid start and end time.";
  }
  return null;
}