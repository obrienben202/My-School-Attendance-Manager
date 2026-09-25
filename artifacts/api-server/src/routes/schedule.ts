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

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getLessonOccurrenceDate(day: string | null, referenceDate = new Date()) {
  const targetDay = getScheduleDayIndex(day);
  if (targetDay === undefined) return formatDate(referenceDate);

  const occurrenceDate = new Date(referenceDate);
  const daysSinceOccurrence = (referenceDate.getDay() - targetDay + 7) % 7;
  occurrenceDate.setDate(referenceDate.getDate() - daysSinceOccurrence);
  return formatDate(occurrenceDate);
}

export type ScheduleFeedRecord = {
  id: number;
  courseId: number;
  startTime: string;
  endTime: string;
  room: string | null;
  staffName: string | null;
  day: string | null;
  registerMarked: boolean;
  courseCode: string | null;
  courseName: string | null;
  courseStaffName: string | null;
};

export type ScheduleFeedEnrollment = {
  courseId: number;
  studentId: number;
};

export type ScheduleFeedRegister = {
  scheduleId: number;
  date: string;
  status: string;
  updatedAt: Date;
  submittedAt: Date | null;
};

export type ScheduleFeedAttendance = {
  scheduleId: number | null;
  date: string;
};

export type ScheduleFeedRepository = {
  listActiveScheduleRecords(): Promise<ScheduleFeedRecord[]>;
  listEnrollments(): Promise<ScheduleFeedEnrollment[]>;
  listRegisters(
    scheduleIds: number[],
    occurrenceDates: string[],
  ): Promise<ScheduleFeedRegister[]>;
  listLegacyAttendance(
    scheduleIds: number[],
    occurrenceDates: string[],
  ): Promise<ScheduleFeedAttendance[]>;
};

const databaseScheduleFeedRepository: ScheduleFeedRepository = {
  listActiveScheduleRecords: () => db
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

  listEnrollments: () => db
    .select({
      courseId: enrollmentsTable.courseId,
      studentId: enrollmentsTable.studentId,
    })
    .from(enrollmentsTable),

  listRegisters: (scheduleIds, occurrenceDates) => db
    .select()
    .from(attendanceRegistersTable)
    .where(and(
      inArray(attendanceRegistersTable.scheduleId, scheduleIds),
      inArray(attendanceRegistersTable.date, occurrenceDates),
    )),

  listLegacyAttendance: (scheduleIds, occurrenceDates) => db
    .select({
      scheduleId: attendanceTable.scheduleId,
      date: attendanceTable.date,
    })
    .from(attendanceTable)
    .where(and(
      inArray(attendanceTable.scheduleId, scheduleIds),
      inArray(attendanceTable.date, occurrenceDates),
    )),
};

export function buildScheduleFeed(
  records: ScheduleFeedRecord[],
  enrollments: ScheduleFeedEnrollment[],
  registers: ScheduleFeedRegister[],
  legacyAttendance: ScheduleFeedAttendance[],
  referenceDate = new Date(),
) {
  const enrollmentCounts = new Map<number, number>();
  for (const enrollment of enrollments) {
    enrollmentCounts.set(
      enrollment.courseId,
      (enrollmentCounts.get(enrollment.courseId) ?? 0) + 1,
    );
  }

  const occurrences = records.map(record => ({
    ...record,
    occurrenceDate: getLessonOccurrenceDate(record.day, referenceDate),
    enrolledCount: enrollmentCounts.get(record.courseId) ?? 0,
  }));
  const registersByOccurrence = new Map(
    registers.map(register => [`${register.scheduleId}:${register.date}`, register]),
  );
  const legacyMarkedOccurrences = new Set(
    legacyAttendance
      .filter(record => record.scheduleId !== null)
      .map(record => `${record.scheduleId}:${record.date}`),
  );

  return occurrences.map(record => {
    const occurrenceKey = `${record.id}:${record.occurrenceDate}`;
    const register = registersByOccurrence.get(occurrenceKey);
    const registerStatus = resolveAttendanceRegisterStatus(
      register?.status,
      legacyMarkedOccurrences.has(occurrenceKey),
    );

    return {
      id: record.id,
      courseId: record.courseId,
      startTime: record.startTime,
      endTime: record.endTime,
      courseCode: record.courseCode ?? "",
      courseName: record.courseName ?? "",
      enrolledCount: record.enrolledCount,
      room: record.room ?? null,
      staffName: record.staffName ?? null,
      day: record.day ?? null,
      occurrenceDate: record.occurrenceDate,
      registerMarked: record.registerMarked,
      registerStatus,
      registerUpdatedAt: register?.updatedAt.toISOString() ?? null,
      registerSubmittedAt: register?.submittedAt?.toISOString() ?? null,
    };
  });
}

export function createScheduleRouter(
  repository: ScheduleFeedRepository = databaseScheduleFeedRepository,
) {
  const router = Router();

  router.get("/schedule/today", async (req, res): Promise<void> => {
    res.set("Cache-Control", "private, no-store, max-age=0");

    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const [records, enrollments] = await Promise.all([
      repository.listActiveScheduleRecords(),
      repository.listEnrollments(),
    ]);
    const occurrences = filterManageableAttendanceSchedules(
      req.user!,
      records.map(record => ({
        ...record,
        scheduleStaffName: record.staffName,
      })),
    );
    const referenceDate = new Date();
    const scheduleIds = [...new Set(occurrences.map(occurrence => occurrence.id))];
    const occurrenceDates = [...new Set(
      occurrences.map(occurrence => getLessonOccurrenceDate(occurrence.day, referenceDate)),
    )];
    const registers = scheduleIds.length > 0
      ? await repository.listRegisters(scheduleIds, occurrenceDates)
      : [];
    const legacyAttendance = scheduleIds.length > 0
      ? await repository.listLegacyAttendance(scheduleIds, occurrenceDates)
      : [];

    res.json(buildScheduleFeed(
      occurrences,
      enrollments,
      registers,
      legacyAttendance,
      referenceDate,
    ));
  });

  return router;
}

const router = createScheduleRouter();

export default router;
