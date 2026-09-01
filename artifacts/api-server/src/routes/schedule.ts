import { Router } from "express";
import { db } from "@workspace/db";
import {
  scheduleTable,
  coursesTable,
  enrollmentsTable,
  attendanceRegistersTable,
  attendanceTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { getScheduleDayIndex } from "../lib/schedule-day";
import { resolveAttendanceRegisterStatus } from "../lib/attendance-register";
import { filterManageableAttendanceSchedules } from "../lib/attendance-authorization";

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

router.get("/schedule/today", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [records, enrollments] = await Promise.all([
    db
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
      courseStaffName: coursesTable.staffName,
    })
    .from(scheduleTable)
    .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
    .where(eq(coursesTable.isActive, true))
    .orderBy(scheduleTable.startTime),
    db
      .select({
        courseId: enrollmentsTable.courseId,
        studentId: enrollmentsTable.studentId,
      })
      .from(enrollmentsTable),
  ]);

  const enrollmentCounts = new Map<number, number>();
  for (const enrollment of enrollments) {
    enrollmentCounts.set(
      enrollment.courseId,
      (enrollmentCounts.get(enrollment.courseId) ?? 0) + 1,
    );
  }

  const occurrences = filterManageableAttendanceSchedules(
    req.user!,
    records.map(record => ({
      ...record,
      scheduleStaffName: record.staffName,
    })),
  )
    .map(record => ({
    ...record,
    occurrenceDate: getLessonOccurrenceDate(record.day),
    enrolledCount: enrollmentCounts.get(record.courseId) ?? 0,
  }));
  const scheduleIds = [...new Set(occurrences.map(occurrence => occurrence.id))];
  const occurrenceDates = [...new Set(occurrences.map(occurrence => occurrence.occurrenceDate))];
  const registers = scheduleIds.length > 0
    ? await db
      .select()
      .from(attendanceRegistersTable)
      .where(and(
        inArray(attendanceRegistersTable.scheduleId, scheduleIds),
        inArray(attendanceRegistersTable.date, occurrenceDates),
      ))
    : [];
  const registersByOccurrence = new Map(
    registers.map(register => [`${register.scheduleId}:${register.date}`, register]),
  );
  const legacyAttendance = scheduleIds.length > 0
    ? await db
      .select({
        scheduleId: attendanceTable.scheduleId,
        date: attendanceTable.date,
      })
      .from(attendanceTable)
      .where(and(
        inArray(attendanceTable.scheduleId, scheduleIds),
        inArray(attendanceTable.date, occurrenceDates),
      ))
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
      enrolledCount: r.enrolledCount,
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
