import type { ScheduleEntry } from "@workspace/api-client-react";

export type RegisterListState =
  | "loading"
  | "error"
  | "no-assigned-lessons"
  | "no-lessons-today"
  | "filter-empty"
  | "ready";

export type RegisterStatus = "Open" | "Saved" | "Submitted";

export type RegisterRow = {
  id: number;
  description: string;
  courseCode: string;
  courseName: string;
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  staff: string;
  status: RegisterStatus;
  enrolled: number;
};

type RegisterListStateInput = {
  isLoading: boolean;
  isError: boolean;
  assignedCount: number;
  registerCount: number;
  filteredCount: number;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayScheduleEntries(entries: ScheduleEntry[], schoolDate: string): ScheduleEntry[] {
  const weekday = WEEKDAYS[new Date(`${schoolDate}T00:00:00Z`).getUTCDay()];
  return entries.filter(entry =>
    entry.occurrenceDate === schoolDate &&
    typeof entry.day === "string" &&
    entry.day.trim().toLowerCase() === weekday.toLowerCase()
  );
}

export function mapScheduleEntryToRegister(entry: ScheduleEntry): RegisterRow {
  const status: RegisterStatus = entry.registerStatus === "submitted"
    ? "Submitted"
    : entry.registerStatus === "draft"
      ? "Saved"
      : "Open";

  return {
    id: entry.id,
    description: `${entry.courseCode} — ${entry.courseName}`,
    courseCode: entry.courseCode,
    courseName: entry.courseName,
    date: entry.occurrenceDate,
    day: entry.day ?? "Not provided",
    startTime: entry.startTime,
    endTime: entry.endTime,
    room: entry.room ?? "Not provided",
    staff: entry.staffName ?? "TBC",
    status,
    enrolled: entry.enrolledCount,
  };
}

export function registerOccurrencePath(id: number, occurrenceDate: string): string {
  return `/registers/${id}?date=${encodeURIComponent(occurrenceDate)}`;
}

export function registerActionLabel(status: RegisterStatus): "Mark Register" | "Edit Attendance" {
  return status === "Submitted" ? "Edit Attendance" : "Mark Register";
}

export function resolveRegisterListState({
  isLoading,
  isError,
  assignedCount,
  registerCount,
  filteredCount,
}: RegisterListStateInput): RegisterListState {
  if (isError) return "error";
  if (isLoading) return "loading";
  if (assignedCount === 0) return "no-assigned-lessons";
  if (registerCount === 0) return "no-lessons-today";
  if (filteredCount === 0) return "filter-empty";
  return "ready";
}

export function registerSummary(
  registers: RegisterRow[],
  state: RegisterListState,
): Record<RegisterStatus, number | null> {
  if (state === "error" || state === "loading") {
    return { Open: null, Saved: null, Submitted: null };
  }
  return {
    Open: registers.filter(register => register.status === "Open").length,
    Saved: registers.filter(register => register.status === "Saved").length,
    Submitted: registers.filter(register => register.status === "Submitted").length,
  };
}

export function hasOnlyEmptyRosters(
  registers: Array<{ enrolled: number }>,
): boolean {
  return registers.length > 0 && registers.every(register => register.enrolled === 0);
}

export function hasEmptyRoster(registers: Array<{ enrolled: number }>): boolean {
  return registers.some(register => register.enrolled === 0);
}