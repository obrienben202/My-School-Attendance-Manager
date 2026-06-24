import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, studentsTable, coursesTable } from "@workspace/db";
import { eq, and, type SQL } from "drizzle-orm";
import {
  ListAttendanceRecordsQueryParams,
  CreateAttendanceRecordBody,
  UpdateAttendanceRecordParams,
  UpdateAttendanceRecordBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/attendance", async (req, res) => {
  const parsed = ListAttendanceRecordsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query params" });

  const { studentId, courseId, date, status } = parsed.data;

  const conditions: SQL[] = [];
  if (studentId) conditions.push(eq(attendanceTable.studentId, studentId));
  if (courseId) conditions.push(eq(attendanceTable.courseId, courseId));
  if (date) conditions.push(eq(attendanceTable.date, date));
  if (status) conditions.push(eq(attendanceTable.status, status));

  const records = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      courseId: attendanceTable.courseId,
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

  const [record] = await db.insert(attendanceTable).values(parsed.data).returning();
  return res.status(201).json({
    ...record,
    studentName: null,
    courseName: null,
    createdAt: record.createdAt.toISOString(),
  });
});

router.patch("/attendance/:id", async (req, res) => {
  const paramsParsed = UpdateAttendanceRecordParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = UpdateAttendanceRecordBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid body" });

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

export default router;
