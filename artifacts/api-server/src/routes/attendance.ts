import { Router } from "express";
import { db } from "@workspace/db";
import {
  attendanceTable,
  studentsTable,
  coursesTable,
  scheduleTable,
  enrollmentsTable,
  attendanceRegistersTable,
  attendanceRegisterAuditTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, inArray, sql, type SQL } from "drizzle-orm";
import {
  ListAttendanceRecordsQueryParams,
  ListAttendanceRegisterAuditQueryParams,
  ListAttendanceRegisterContactsQueryParams,
  ListAttendanceRegisterRosterQueryParams,
  GetAttendanceRegisterStateQueryParams,
  CreateAttendanceRecordBody,
  SubmitAttendanceRegisterBody,
  ReopenAttendanceRegisterBody,
  UpdateAttendanceRecordParams,
  UpdateAttendanceRecordBody,
  DeleteAttendanceRecordParams,
} from "@workspace/api-zod";
import { canManageAttendanceSchedule } from "../lib/attendance-authorization";
import {
  assertAttendanceRegisterMutable,
  replaceAttendanceRegister,
  resolveAttendanceRegisterStatus,
  SubmittedRegisterLockedError,
} from "../lib/attendance-register";
import {
  attendanceDateMatchesScheduleDay,
  formatAttendanceDateOnly,
  parseAttendanceDateOnly,
} from "../lib/schedule-day";

const router = Router();

function withStrictDateOnly(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  return {
    ...record,
    date: parseAttendanceDateOnly(record.date),
  };
}

async function getScheduleAssignment(scheduleId: number) {
  const [assignment] = await db
    .select({
      id: scheduleTable.id,
      courseId: scheduleTable.courseId,
      scheduleStaffName: scheduleTable.staffName,
      courseStaffName: coursesTable.staffName,
      scheduleDay: scheduleTable.day,
      isActive: scheduleTable.isActive,
    })
    .from(scheduleTable)
    .leftJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
    .where(eq(scheduleTable.id, scheduleId))
    .limit(1);
  return assignment;
}

async function canUseScheduleOccurrence(
  schedule: NonNullable<Awaited<ReturnType<typeof getScheduleAssignment>>>, date: Date,
) {
  if (schedule.isActive && attendanceDateMatchesScheduleDay(date, schedule.scheduleDay)) return true;
  // Sheet edits may move a lesson to another weekday. Its saved occurrences
  // remain accessible by their original date, without allowing new registers
  // on the wrong weekday or new occurrences for retired lessons.
  const dateOnly = formatAttendanceDateOnly(date);
  const [registers, marks, audit] = await Promise.all([
    db.select({ id: attendanceRegistersTable.id }).from(attendanceRegistersTable)
      .where(and(eq(attendanceRegistersTable.scheduleId, schedule.id), eq(attendanceRegistersTable.date, dateOnly))).limit(1),
    db.select({ id: attendanceTable.id }).from(attendanceTable)
      .where(and(eq(attendanceTable.scheduleId, schedule.id), eq(attendanceTable.date, dateOnly))).limit(1),
    db.select({ id: attendanceRegisterAuditTable.id }).from(attendanceRegisterAuditTable)
      .where(and(eq(attendanceRegisterAuditTable.scheduleId, schedule.id), eq(attendanceRegisterAuditTable.date, dateOnly))).limit(1),
  ]);
  return registers.length + marks.length + audit.length > 0;
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

async function getManageableScheduleIds(user: NonNullable<Express.Request["user"]>) {
  if (user.role === "admin" || user.role === "hod") return null;

  const schedules = await db
    .select({
      id: scheduleTable.id,
      scheduleStaffName: scheduleTable.staffName,
      courseStaffName: coursesTable.staffName,
    })
    .from(scheduleTable)
    .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
    .where(eq(coursesTable.isActive, true));

  return schedules
    .filter(schedule => canManageAttendanceSchedule(user, schedule))
    .map(schedule => schedule.id);
}

router.use("/attendance", (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  return next();
});

router.get("/attendance", async (req, res) => {
  const queryDate = typeof req.query.date === "string"
    ? parseAttendanceDateOnly(req.query.date)
    : req.query.date;
  const parsed = ListAttendanceRecordsQueryParams.safeParse({
    ...req.query,
    date: queryDate,
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid query params" });

  const { studentId, courseId, scheduleId, date, status } = parsed.data;

  const conditions: SQL[] = [];
  if (studentId) conditions.push(eq(attendanceTable.studentId, studentId));
  if (courseId) conditions.push(eq(attendanceTable.courseId, courseId));
  if (scheduleId !== undefined) conditions.push(eq(attendanceTable.scheduleId, scheduleId));
  if (date) conditions.push(eq(attendanceTable.date, formatAttendanceDateOnly(date)));
  if (status) conditions.push(eq(attendanceTable.status, status));

  const manageableScheduleIds = await getManageableScheduleIds(req.user!);
  if (manageableScheduleIds !== null) {
    if (scheduleId !== undefined && !manageableScheduleIds.includes(scheduleId)) {
      res.status(403).json({ error: "You are not assigned to this lesson register" });
      return;
    }
    if (scheduleId === undefined) {
      if (manageableScheduleIds.length === 0) return res.json([]);
      conditions.push(inArray(attendanceTable.scheduleId, manageableScheduleIds));
    }
  }

  const records = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      courseId: attendanceTable.courseId,
      scheduleId: attendanceTable.scheduleId,
      date: attendanceTable.date,
      status: attendanceTable.status,
      minutesLate: attendanceTable.minutesLate,
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

router.get("/attendance/register/roster", async (req, res) => {
  const queryDate = typeof req.query.date === "string"
    ? parseAttendanceDateOnly(req.query.date)
    : req.query.date;
  const parsed = ListAttendanceRegisterRosterQueryParams.safeParse({
    ...req.query,
    date: queryDate,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid register occurrence" });
    return;
  }

  const schedule = await getScheduleAssignment(parsed.data.scheduleId);
  if (!schedule) {
    res.status(404).json({ error: "Schedule session not found" });
    return;
  }
  if (!await canUseScheduleOccurrence(schedule, parsed.data.date)) {
    res.status(400).json({ error: "Attendance date does not match the schedule day" });
    return;
  }
  if (!canManageAttendanceSchedule(req.user!, schedule)) {
    res.status(403).json({ error: "You are not assigned to this lesson register" });
    return;
  }

  const students = await db
    .select({
      id: studentsTable.id,
      personCode: studentsTable.personCode,
      forename: studentsTable.forename,
      surname: studentsTable.surname,
      atRisk: studentsTable.atRisk,
    })
    .from(enrollmentsTable)
    .innerJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .where(eq(enrollmentsTable.courseId, schedule.courseId))
    .orderBy(studentsTable.surname, studentsTable.forename);

  res.json(students);
});

router.post("/attendance", async (req, res) => {
  const parsed = CreateAttendanceRecordBody.safeParse(withStrictDateOnly(req.body));
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const { date, scheduleId, ...restAttendance } = parsed.data;
  const schedule = await getScheduleAssignment(scheduleId);
  if (!schedule || schedule.courseId !== restAttendance.courseId) {
    return res.status(400).json({ error: "Schedule session does not belong to the selected course" });
  }
  if (!await canUseScheduleOccurrence(schedule, date)) {
    return res.status(400).json({ error: "Attendance date does not match the schedule day" });
  }
  if (!canManageAttendanceSchedule(req.user!, schedule)) {
    return res.status(403).json({ error: "You are not assigned to this lesson register" });
  }
  const enrolledStudentIds = await getEnrolledStudentIds(schedule.courseId, [restAttendance.studentId]);
  if (!enrolledStudentIds.has(restAttendance.studentId)) {
    return res.status(400).json({ error: "Learner is not enrolled on this lesson's course" });
  }

  const attendanceDate = formatAttendanceDateOnly(date);
  let record;
  try {
    [record] = await db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`${scheduleId}:${attendanceDate}`}, 0)
        )
      `);
      const [register] = await tx
        .select({ status: attendanceRegistersTable.status })
        .from(attendanceRegistersTable)
        .where(and(
          eq(attendanceRegistersTable.scheduleId, scheduleId),
          eq(attendanceRegistersTable.date, attendanceDate),
        ))
        .limit(1);
      assertAttendanceRegisterMutable(register?.status);

      return tx
        .insert(attendanceTable)
        .values({
          ...restAttendance,
          scheduleId,
          date: attendanceDate,
        })
        .returning();
    });
  } catch (error) {
    if (error instanceof SubmittedRegisterLockedError) {
      return res.status(409).json({ error: "Submitted registers must be reopened before marks can be added" });
    }
    throw error;
  }
  return res.status(201).json({
    ...record,
    studentName: null,
    courseName: null,
    createdAt: record.createdAt.toISOString(),
  });
});

router.post("/attendance/register", async (req, res) => {
  const parsed = SubmitAttendanceRegisterBody.safeParse(withStrictDateOnly(req.body));
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const { scheduleId, date, status, marks } = parsed.data;
  const uniqueStudentIds = new Set(marks.map(mark => mark.studentId));
  if (uniqueStudentIds.size !== marks.length) {
    return res.status(400).json({ error: "Each learner can only be marked once per register" });
  }

  const schedule = await getScheduleAssignment(scheduleId);
  if (!schedule) return res.status(404).json({ error: "Schedule session not found" });
  if (!await canUseScheduleOccurrence(schedule, date)) {
    return res.status(400).json({ error: "Attendance date does not match the schedule day" });
  }
  if (!canManageAttendanceSchedule(req.user!, schedule)) {
    return res.status(403).json({ error: "You are not assigned to this lesson register" });
  }
  const enrolledStudentIds = await getEnrolledStudentIds(schedule.courseId, [...uniqueStudentIds]);
  if (enrolledStudentIds.size !== uniqueStudentIds.size) {
    return res.status(400).json({ error: "Every learner must be enrolled on this lesson's course" });
  }

  const attendanceDate = formatAttendanceDateOnly(date);
  const now = new Date();
  let result;
  try {
    result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`${scheduleId}:${attendanceDate}`}, 0)
        )
      `);
      const [existingRegister] = await tx
        .select({ status: attendanceRegistersTable.status })
        .from(attendanceRegistersTable)
        .where(and(
          eq(attendanceRegistersTable.scheduleId, scheduleId),
          eq(attendanceRegistersTable.date, attendanceDate),
        ))
        .limit(1);
      assertAttendanceRegisterMutable(existingRegister?.status);

      const records = await replaceAttendanceRegister(tx, {
        scheduleId,
        courseId: schedule.courseId,
        date: attendanceDate,
        marks,
        markedBy: req.user!.id,
      });

      const [register] = await tx
        .insert(attendanceRegistersTable)
        .values({
          scheduleId,
          date: attendanceDate,
          status,
          updatedBy: req.user!.id,
          submittedAt: status === "submitted" ? now : null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [attendanceRegistersTable.scheduleId, attendanceRegistersTable.date],
          set: {
            status,
            updatedBy: req.user!.id,
            submittedAt: status === "submitted" ? now : null,
            updatedAt: now,
          },
        })
        .returning();

      await tx.insert(attendanceRegisterAuditTable).values({
        scheduleId,
        date: attendanceDate,
        action: status === "submitted" ? "submitted" : "saved_draft",
        userId: req.user!.id,
        details: `${status === "submitted" ? "Submitted" : "Saved draft with"} ${marks.length} learner mark${marks.length === 1 ? "" : "s"}`,
        createdAt: now,
      });

      return { records, register };
    });
  } catch (error) {
    if (error instanceof SubmittedRegisterLockedError) {
      return res.status(409).json({ error: "Submitted registers must be explicitly reopened before they can be changed" });
    }
    throw error;
  }

  return res.json({
    scheduleId,
    date: attendanceDate,
    status: result.register.status,
    updatedAt: result.register.updatedAt.toISOString(),
    submittedAt: result.register.submittedAt?.toISOString() ?? null,
    marks: result.records.map(record => ({
      ...record,
      studentName: null,
      courseName: null,
      createdAt: record.createdAt.toISOString(),
    })),
  });
});

router.get("/attendance/register/audit", async (req, res) => {
  const queryDate = typeof req.query.date === "string"
    ? parseAttendanceDateOnly(req.query.date)
    : req.query.date;
  const parsed = ListAttendanceRegisterAuditQueryParams.safeParse({
    ...req.query,
    date: queryDate,
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid register occurrence" });

  const schedule = await getScheduleAssignment(parsed.data.scheduleId);
  if (!schedule) return res.status(404).json({ error: "Schedule session not found" });
  if (!await canUseScheduleOccurrence(schedule, parsed.data.date)) {
    return res.status(400).json({ error: "Attendance date does not match the schedule day" });
  }
  if (!canManageAttendanceSchedule(req.user!, schedule)) {
    return res.status(403).json({ error: "You are not assigned to this lesson register" });
  }

  const attendanceDate = formatAttendanceDateOnly(parsed.data.date);
  const records = await db
    .select({
      id: attendanceRegisterAuditTable.id,
      scheduleId: attendanceRegisterAuditTable.scheduleId,
      date: attendanceRegisterAuditTable.date,
      action: attendanceRegisterAuditTable.action,
      details: attendanceRegisterAuditTable.details,
      createdAt: attendanceRegisterAuditTable.createdAt,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      username: usersTable.username,
    })
    .from(attendanceRegisterAuditTable)
    .leftJoin(usersTable, eq(attendanceRegisterAuditTable.userId, usersTable.id))
    .where(and(
      eq(attendanceRegisterAuditTable.scheduleId, parsed.data.scheduleId),
      eq(attendanceRegisterAuditTable.date, attendanceDate),
    ))
    .orderBy(desc(attendanceRegisterAuditTable.createdAt));

  return res.json(records.map(record => ({
    id: record.id,
    scheduleId: record.scheduleId,
    date: record.date,
    action: record.action,
    actorName: [record.firstName, record.lastName].filter(Boolean).join(" ")
      || record.username
      || "Unknown user",
    details: record.details,
    createdAt: record.createdAt.toISOString(),
  })));
});

router.get("/attendance/register/contacts", async (req, res) => {
  const queryDate = typeof req.query.date === "string"
    ? parseAttendanceDateOnly(req.query.date)
    : req.query.date;
  const parsed = ListAttendanceRegisterContactsQueryParams.safeParse({
    ...req.query,
    date: queryDate,
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid register occurrence" });

  const schedule = await getScheduleAssignment(parsed.data.scheduleId);
  if (!schedule) return res.status(404).json({ error: "Schedule session not found" });
  if (!await canUseScheduleOccurrence(schedule, parsed.data.date)) {
    return res.status(400).json({ error: "Attendance date does not match the schedule day" });
  }
  if (!canManageAttendanceSchedule(req.user!, schedule)) {
    return res.status(403).json({ error: "You are not assigned to this lesson register" });
  }

  const contacts = await db
    .select({
      studentId: enrollmentsTable.studentId,
      contactEmail: enrollmentsTable.contactEmail,
    })
    .from(enrollmentsTable)
    .where(eq(enrollmentsTable.courseId, schedule.courseId));

  return res.json(contacts);
});

router.get("/attendance/register/state", async (req, res) => {
  const queryDate = typeof req.query.date === "string"
    ? parseAttendanceDateOnly(req.query.date)
    : req.query.date;
  const parsed = GetAttendanceRegisterStateQueryParams.safeParse({
    ...req.query,
    date: queryDate,
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid register occurrence" });

  const schedule = await getScheduleAssignment(parsed.data.scheduleId);
  if (!schedule) return res.status(404).json({ error: "Schedule session not found" });
  if (!await canUseScheduleOccurrence(schedule, parsed.data.date)) {
    return res.status(400).json({ error: "Attendance date does not match the schedule day" });
  }
  if (!canManageAttendanceSchedule(req.user!, schedule)) {
    return res.status(403).json({ error: "You are not assigned to this lesson register" });
  }

  const attendanceDate = formatAttendanceDateOnly(parsed.data.date);
  const [register] = await db
    .select()
    .from(attendanceRegistersTable)
    .where(and(
      eq(attendanceRegistersTable.scheduleId, parsed.data.scheduleId),
      eq(attendanceRegistersTable.date, attendanceDate),
    ))
    .limit(1);
  const [legacyMark] = register
    ? []
    : await db
      .select({ id: attendanceTable.id })
      .from(attendanceTable)
      .where(and(
        eq(attendanceTable.scheduleId, parsed.data.scheduleId),
        eq(attendanceTable.date, attendanceDate),
      ))
      .limit(1);

  return res.json({
    scheduleId: parsed.data.scheduleId,
    date: attendanceDate,
    status: resolveAttendanceRegisterStatus(register?.status, Boolean(legacyMark)),
    updatedAt: register?.updatedAt.toISOString() ?? null,
    submittedAt: register?.submittedAt?.toISOString() ?? null,
  });
});

router.post("/attendance/register/reopen", async (req, res) => {
  const parsed = ReopenAttendanceRegisterBody.safeParse(withStrictDateOnly(req.body));
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const { scheduleId, date } = parsed.data;
  const schedule = await getScheduleAssignment(scheduleId);
  if (!schedule) return res.status(404).json({ error: "Schedule session not found" });
  if (!await canUseScheduleOccurrence(schedule, date)) {
    return res.status(400).json({ error: "Attendance date does not match the schedule day" });
  }
  if (!canManageAttendanceSchedule(req.user!, schedule)) {
    return res.status(403).json({ error: "You are not assigned to this lesson register" });
  }

  const attendanceDate = formatAttendanceDateOnly(date);
  const now = new Date();
  const register = await db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${scheduleId}:${attendanceDate}`}, 0)
      )
    `);
    const [existingRegister] = await tx
      .select()
      .from(attendanceRegistersTable)
      .where(and(
        eq(attendanceRegistersTable.scheduleId, scheduleId),
        eq(attendanceRegistersTable.date, attendanceDate),
      ))
      .limit(1);
    if (!existingRegister || existingRegister.status !== "submitted") return null;

    const [reopened] = await tx
      .update(attendanceRegistersTable)
      .set({
        status: "draft",
        updatedBy: req.user!.id,
        submittedAt: null,
        updatedAt: now,
      })
      .where(eq(attendanceRegistersTable.id, existingRegister.id))
      .returning();

    await tx.insert(attendanceRegisterAuditTable).values({
      scheduleId,
      date: attendanceDate,
      action: "reopened",
      userId: req.user!.id,
      details: "Reopened submitted register for correction",
      createdAt: now,
    });
    return reopened;
  });

  if (!register) {
    return res.status(409).json({ error: "Only a submitted register can be reopened" });
  }
  return res.json({
    scheduleId,
    date: attendanceDate,
    status: "draft",
    updatedAt: register.updatedAt.toISOString(),
    submittedAt: null,
  });
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
      date: attendanceTable.date,
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

  let record;
  try {
    [record] = await db.transaction(async (tx) => {
      if (existing.scheduleId != null) {
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`${existing.scheduleId}:${existing.date}`}, 0)
          )
        `);
        const [register] = await tx
          .select({ status: attendanceRegistersTable.status })
          .from(attendanceRegistersTable)
          .where(and(
            eq(attendanceRegistersTable.scheduleId, existing.scheduleId),
            eq(attendanceRegistersTable.date, existing.date),
          ))
          .limit(1);
        assertAttendanceRegisterMutable(register?.status);
      }
      return tx
        .update(attendanceTable)
        .set(bodyParsed.data)
        .where(eq(attendanceTable.id, paramsParsed.data.id))
        .returning();
    });
  } catch (error) {
    if (error instanceof SubmittedRegisterLockedError) {
      return res.status(409).json({ error: "Submitted registers must be reopened before individual marks can be changed" });
    }
    throw error;
  }
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
    .select({
      scheduleId: attendanceTable.scheduleId,
      date: attendanceTable.date,
    })
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

  let record;
  try {
    [record] = await db.transaction(async (tx) => {
      if (existing.scheduleId != null) {
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`${existing.scheduleId}:${existing.date}`}, 0)
          )
        `);
        const [register] = await tx
          .select({ status: attendanceRegistersTable.status })
          .from(attendanceRegistersTable)
          .where(and(
            eq(attendanceRegistersTable.scheduleId, existing.scheduleId),
            eq(attendanceRegistersTable.date, existing.date),
          ))
          .limit(1);
        assertAttendanceRegisterMutable(register?.status);
      }
      return tx
        .delete(attendanceTable)
        .where(eq(attendanceTable.id, paramsParsed.data.id))
        .returning({ id: attendanceTable.id });
    });
  } catch (error) {
    if (error instanceof SubmittedRegisterLockedError) {
      return res.status(409).json({ error: "Submitted registers must be reopened before marks can be deleted" });
    }
    throw error;
  }
  if (!record) return res.status(404).json({ error: "Not found" });

  return res.status(204).send();
});

export default router;
