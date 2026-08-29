import { Router } from "express";
import { db } from "@workspace/db";
import {
  attendanceTable,
  studentsTable,
  coursesTable,
  scheduleTable,
  enrollmentsTable,
} from "@workspace/db";
import { eq, and, inArray, sql, type SQL } from "drizzle-orm";
import {
  ListAttendanceRecordsQueryParams,
  CreateAttendanceRecordBody,
  SubmitAttendanceRegisterBody,
  UpdateAttendanceRecordParams,
  UpdateAttendanceRecordBody,
  DeleteAttendanceRecordParams,
} from "@workspace/api-zod";
import { canManageAttendanceSchedule } from "../lib/attendance-authorization";

const router = Router();

async function getScheduleAssignment(scheduleId: number) {
  const [assignment] = await db
    .select({
      id: scheduleTable.id,
      courseId: scheduleTable.courseId,
      scheduleStaffName: scheduleTable.staffName,
      courseStaffName: coursesTable.staffName,
    })
    .from(scheduleTable)
    .leftJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
    .where(eq(scheduleTable.id, scheduleId))
    .limit(1);
  return assignment;
}

async function getEnrolledStudentIds(courseId: number, studentIds: number[]) {
  if (studentIds.length === 0) return new Set<number>();

  const enrollments = await db
    .select({ studentId: enrollmentsTable.studentId })
    .from(enrollmentsTable)
    .where(and(
      eq(enrollmentsTable.courseId, courseId),
      inArray(enrollmentsTable.studentId, studentIds),
    ));
  return new Set(enrollments.map(enrollment => enrollment.studentId));
}

router.use("/attendance", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  return next();
});

router.get("/attendance", async (req, res) => {
  const parsed = ListAttendanceRecordsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query params" });

  const { studentId, courseId, scheduleId, date, status } = parsed.data;

  const conditions: SQL[] = [];
  if (studentId) conditions.push(eq(attendanceTable.studentId, studentId));
  if (courseId) conditions.push(eq(attendanceTable.courseId, courseId));
  if (scheduleId !== undefined) conditions.push(eq(attendanceTable.scheduleId, scheduleId));
  if (date) conditions.push(eq(attendanceTable.date, date instanceof Date ? date.toISOString().split("T")[0] : date));
  if (status) conditions.push(eq(attendanceTable.status, status));

  const records = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      courseId: attendanceTable.courseId,
      scheduleId: attendanceTable.scheduleId,
      date: attendanceTable.date,
      status: attendanceTable.status,
      notes: attendanceTable.notes,
      createdAt: attendanceTable.createdAt,
      studentName: studentsTable.forename,
      courseName: coursesTable.name,
    })
    .from(attendanceTable)
    .leftJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .leftJoin(coursesTable, eq(attendanceTable.courseId, coursesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(attendanceTable.date);

  return res.json(records.map(r => ({
    ...r,
    studentName: r.studentName ?? null,
    courseName: r.courseName ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/attendance", async (req, res) => {
  const parsed = CreateAttendanceRecordBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const { date, scheduleId, ...restAttendance } = parsed.data;
  const schedule = await getScheduleAssignment(scheduleId);
  if (!schedule || schedule.courseId !== restAttendance.courseId) {
    return res.status(400).json({ error: "Schedule session does not belong to the selected course" });
  }
  if (!canManageAttendanceSchedule(req.user!, schedule)) {
    return res.status(403).json({ error: "You are not assigned to this lesson register" });
  }
  const enrolledStudentIds = await getEnrolledStudentIds(schedule.courseId, [restAttendance.studentId]);
  if (!enrolledStudentIds.has(restAttendance.studentId)) {
    return res.status(400).json({ error: "Learner is not enrolled on this lesson's course" });
  }

  const [record] = await db.insert(attendanceTable).values({
    ...restAttendance,
    scheduleId,
    date: date instanceof Date ? date.toISOString().split("T")[0] : date,
  }).returning();
  return res.status(201).json({
    ...record,
    studentName: null,
    courseName: null,
    createdAt: record.createdAt.toISOString(),
  });
});

router.post("/attendance/register", async (req, res) => {
  const parsed = SubmitAttendanceRegisterBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const { scheduleId, date, marks } = parsed.data;
  const uniqueStudentIds = new Set(marks.map(mark => mark.studentId));
  if (uniqueStudentIds.size !== marks.length) {
    return res.status(400).json({ error: "Each learner can only be marked once per register" });
  }

  const schedule = await getScheduleAssignment(scheduleId);
  if (!schedule) return res.status(404).json({ error: "Schedule session not found" });
  if (!canManageAttendanceSchedule(req.user!, schedule)) {
    return res.status(403).json({ error: "You are not assigned to this lesson register" });
  }
  const enrolledStudentIds = await getEnrolledStudentIds(schedule.courseId, [...uniqueStudentIds]);
  if (enrolledStudentIds.size !== uniqueStudentIds.size) {
    return res.status(400).json({ error: "Every learner must be enrolled on this lesson's course" });
  }

  const attendanceDate = date.toISOString().split("T")[0];
  const records = await db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${scheduleId}:${attendanceDate}`}, 0)
      )
    `);

    await tx
      .delete(attendanceTable)
      .where(and(
        eq(attendanceTable.scheduleId, scheduleId),
        eq(attendanceTable.date, attendanceDate),
      ));

    const saved = marks.length > 0
      ? await tx
        .insert(attendanceTable)
        .values(marks.map(mark => ({
          studentId: mark.studentId,
          courseId: schedule.courseId,
          scheduleId,
          date: attendanceDate,
          status: mark.status,
          notes: mark.notes,
          markedBy: req.user!.id,
        })))
        .returning()
      : [];

    await tx
      .update(scheduleTable)
      .set({ registerMarked: saved.length > 0 })
      .where(eq(scheduleTable.id, scheduleId));

    return saved;
  });

  return res.json(records.map(record => ({
    ...record,
    studentName: null,
    courseName: null,
    createdAt: record.createdAt.toISOString(),
  })));
});

router.patch("/attendance/:id", async (req, res) => {
  const paramsParsed = UpdateAttendanceRecordParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = UpdateAttendanceRecordBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid body" });

  const [existing] = await db
    .select({
      courseId: attendanceTable.courseId,
      scheduleId: attendanceTable.scheduleId,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.id, paramsParsed.data.id))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (existing.scheduleId == null) {
    if (req.user!.role !== "admin" && req.user!.role !== "hod") {
      return res.status(403).json({ error: "Only privileged staff can edit legacy attendance" });
    }
  } else {
    const schedule = await getScheduleAssignment(existing.scheduleId);
    if (!schedule || schedule.courseId !== existing.courseId) {
      return res.status(400).json({ error: "Schedule session does not belong to the attendance course" });
    }
    if (!canManageAttendanceSchedule(req.user!, schedule)) {
      return res.status(403).json({ error: "You are not assigned to this lesson register" });
    }
  }

  if (
    bodyParsed.data.scheduleId !== undefined &&
    bodyParsed.data.scheduleId !== existing.scheduleId
  ) {
    return res.status(400).json({ error: "Attendance records cannot be moved between lesson sessions" });
  }

  const [record] = await db
    .update(attendanceTable)
    .set(bodyParsed.data)
    .where(eq(attendanceTable.id, paramsParsed.data.id))
    .returning();
  if (!record) return res.status(404).json({ error: "Not found" });

  return res.json({
    ...record,
    studentName: null,
    courseName: null,
    createdAt: record.createdAt.toISOString(),
  });
});

router.delete("/attendance/:id", async (req, res) => {
  const paramsParsed = DeleteAttendanceRecordParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });

  const [existing] = await db
    .select({ scheduleId: attendanceTable.scheduleId })
    .from(attendanceTable)
    .where(eq(attendanceTable.id, paramsParsed.data.id))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (existing.scheduleId == null) {
    if (req.user!.role !== "admin" && req.user!.role !== "hod") {
      return res.status(403).json({ error: "Only privileged staff can delete legacy attendance" });
    }
  } else {
    const schedule = await getScheduleAssignment(existing.scheduleId);
    if (!schedule || !canManageAttendanceSchedule(req.user!, schedule)) {
      return res.status(403).json({ error: "You are not assigned to this lesson register" });
    }
  }

  const [record] = await db
    .delete(attendanceTable)
    .where(eq(attendanceTable.id, paramsParsed.data.id))
    .returning({ id: attendanceTable.id });
  if (!record) return res.status(404).json({ error: "Not found" });

  return res.status(204).send();
});

export default router;
