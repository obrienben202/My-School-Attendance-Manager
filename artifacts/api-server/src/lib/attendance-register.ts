import { attendanceTable, scheduleTable } from "@workspace/db";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Attendance } from "@workspace/db";

export type AttendanceRegisterMark = {
  studentId: number;
  status: string;
  minutesLate?: number;
  notes?: string;
};

export class SubmittedRegisterLockedError extends Error {}

export function assertAttendanceRegisterMutable(status: string | null | undefined): void {
  if (status === "submitted") throw new SubmittedRegisterLockedError();
}

export function resolveAttendanceRegisterStatus(
  persistedStatus: string | null | undefined,
  hasExactAttendance: boolean,
): "open" | "draft" | "submitted" {
  if (persistedStatus === "submitted") return "submitted";
  if (persistedStatus === "draft") return "draft";
  return hasExactAttendance ? "draft" : "open";
}

export type AttendanceRegisterTransaction = {
  execute(query: SQL): Promise<unknown>;
  delete(table: typeof attendanceTable): {
    where(condition: SQL): Promise<unknown>;
  };
  insert(table: typeof attendanceTable): {
    values(values: Array<{
      studentId: number;
      courseId: number;
      scheduleId: number;
      date: string;
      status: string;
      minutesLate?: number;
      notes?: string;
      markedBy: string;
    }>): {
      returning(): Promise<Attendance[]>;
    };
  };
  update(table: typeof scheduleTable): {
    set(values: { registerMarked: boolean }): {
      where(condition: SQL): Promise<unknown>;
    };
  };
};

type ReplaceAttendanceRegisterInput = {
  scheduleId: number;
  courseId: number;
  date: string;
  marks: ReadonlyArray<AttendanceRegisterMark>;
  markedBy: string;
};

/**
 * Replace every mark for one timetable session in one transaction.
 *
 * The advisory lock is intentionally acquired inside the transaction. This
 * prevents two staff requests for the same lesson/date from both deleting the
 * old rows and then inserting duplicate replacements.
 */
export async function replaceAttendanceRegister(
  tx: AttendanceRegisterTransaction,
  input: ReplaceAttendanceRegisterInput,
): Promise<Attendance[]> {
  const { scheduleId, courseId, date, marks, markedBy } = input;

  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`${scheduleId}:${date}`}, 0)
    )
  `);

  await tx
    .delete(attendanceTable)
    .where(and(
      eq(attendanceTable.scheduleId, scheduleId),
      eq(attendanceTable.date, date),
    )!);

  const saved = marks.length > 0
    ? await tx
      .insert(attendanceTable)
      .values(marks.map(mark => ({
        studentId: mark.studentId,
        courseId,
        scheduleId,
        date,
        status: mark.status,
        minutesLate: mark.status === "late" ? mark.minutesLate : undefined,
        notes: mark.notes,
        markedBy,
      })))
      .returning()
    : [];

  await tx
    .update(scheduleTable)
    .set({ registerMarked: saved.length > 0 })
    .where(eq(scheduleTable.id, scheduleId));

  return saved;
}