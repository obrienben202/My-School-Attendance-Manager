import type { ScheduleEntry } from "@workspace/api-client-react";

export type RegisterListState =
  | "loading"
  | "error"
  | "no-assigned-lessons"
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
  registerCount: number;
  filteredCount: number;
};

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
  registerCount,
  filteredCount,
}: RegisterListStateInput): RegisterListState {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (registerCount === 0) return "no-assigned-lessons";
  if (filteredCount === 0) return "filter-empty";
  return "ready";
}

export function hasOnlyEmptyRosters(
  registers: Array<{ enrolled: number }>,
): boolean {
  return registers.length > 0 && registers.every(register => register.enrolled === 0);
}

export function hasEmptyRoster(registers: Array<{ enrolled: number }>): boolean {
  return registers.some(register => register.enrolled === 0);
}