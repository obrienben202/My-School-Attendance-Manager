import { Router } from "express";
import { db } from "@workspace/db";
import {
  scheduleTable,
  coursesTable,
  attendanceRegistersTable,
  attendanceTable,
} from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { getScheduleDayIndex } from "../lib/schedule-day";
import { resolveAttendanceRegisterStatus } from "../lib/attendance-register";

const router = Router();

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getLessonOccurrenceDate(day: string | null, referenceDate = new Date()) {
  const targetDay = getScheduleDayIndex(day);
  if (targetDay === undefined) return formatDate(referenceDate);

  const occurrenceDate = new Date(referenceDate);
  const daysSinceOccurrence = (referenceDate.getDay() - targetDay + 7) % 7;
  occurrenceDate.setDate(referenceDate.getDate() - daysSinceOccurrence);
  return formatDate(occurrenceDate);
}

router.get("/schedule/today", async (_req, res) => {
  const records = await db
    .select({
      id: scheduleTable.id,
      courseId: scheduleTable.courseId,
      startTime: scheduleTable.startTime,
      endTime: scheduleTable.endTime,
      room: scheduleTable.room,
      staffName: scheduleTable.staffName,
      day: scheduleTable.day,
      registerMarked: scheduleTable.registerMarked,
      courseCode: coursesTable.code,
      courseName: coursesTable.name,
    })
    .from(scheduleTable)
    .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
    .where(eq(coursesTable.isActive, true))
    .orderBy(scheduleTable.startTime);

  const occurrences = records.map(record => ({
    ...record,
    occurrenceDate: getLessonOccurrenceDate(record.day),
  }));
  const occurrenceConditions = occurrences.map(occurrence => and(
    eq(attendanceRegistersTable.scheduleId, occurrence.id),
    eq(attendanceRegistersTable.date, occurrence.occurrenceDate),
  )!);
  const registers = occurrenceConditions.length > 0
    ? await db
      .select()
      .from(attendanceRegistersTable)
      .where(or(...occurrenceConditions))
    : [];
  const registersByOccurrence = new Map(
    registers.map(register => [`${register.scheduleId}:${register.date}`, register]),
  );
  const legacyAttendance = occurrenceConditions.length > 0
    ? await db
      .select({
        scheduleId: attendanceTable.scheduleId,
        date: attendanceTable.date,
      })
      .from(attendanceTable)
      .where(or(...occurrences.map(occurrence => and(
        eq(attendanceTable.scheduleId, occurrence.id),
        eq(attendanceTable.date, occurrence.occurrenceDate),
      )!)))
    : [];
  const legacyMarkedOccurrences = new Set(
    legacyAttendance.map(record => `${record.scheduleId}:${record.date}`),
  );

  return res.json(occurrences.map(r => {
    const occurrenceKey = `${r.id}:${r.occurrenceDate}`;
    const register = registersByOccurrence.get(occurrenceKey);
    const registerStatus = resolveAttendanceRegisterStatus(
      register?.status,
      legacyMarkedOccurrences.has(occurrenceKey),
    );

    return {
      id: r.id,
      courseId: r.courseId,
      startTime: r.startTime,
      endTime: r.endTime,
      courseCode: r.courseCode ?? "",
      courseName: r.courseName ?? "",
      room: r.room ?? null,
      staffName: r.staffName ?? null,
      day: r.day ?? null,
      occurrenceDate: r.occurrenceDate,
      registerMarked: r.registerMarked,
      registerStatus,
      registerUpdatedAt: register?.updatedAt.toISOString() ?? null,
      registerSubmittedAt: register?.submittedAt?.toISOString() ?? null,
    };
  }));
});

export default router;
