import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable } from "@workspace/db";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import {
  ListStudentsQueryParams,
  CreateStudentBody,
  UpdateStudentParams,
  UpdateStudentBody,
  DeleteStudentParams,
  GetStudentParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/students", async (req, res) => {
  const parsed = ListStudentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query params" });
  }
  const { personCode, forename, surname, gender, yearGroup, atRisk } = parsed.data;

  const conditions: SQL[] = [];
  if (personCode) conditions.push(ilike(studentsTable.personCode, `%${personCode}%`));
  if (forename) conditions.push(ilike(studentsTable.forename, `%${forename}%`));
  if (surname) conditions.push(ilike(studentsTable.surname, `%${surname}%`));
  if (gender) conditions.push(eq(studentsTable.gender, gender));
  if (yearGroup) conditions.push(eq(studentsTable.yearGroup, yearGroup));
  if (atRisk !== undefined) conditions.push(eq(studentsTable.atRisk, atRisk));

  const students = await db
    .select()
    .from(studentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(studentsTable.surname);

  return res.json(students.map(toStudentResponse));
});

router.post("/students", async (req, res) => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }
  const { dateOfBirth, ...restData } = parsed.data;
  const [student] = await db.insert(studentsTable).values({
    ...restData,
    dateOfBirth: dateOfBirth instanceof Date ? dateOfBirth.toISOString().split("T")[0] : (dateOfBirth ?? null),
  }).returning();
  return res.status(201).json(toStudentResponse(student));
});

router.get("/students/at-risk", async (req, res) => {
  const students = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.atRisk, true))
    .orderBy(studentsTable.surname);
  return res.json(students.map(toStudentResponse));
});

router.get("/students/:id", async (req, res) => {
  const parsed = GetStudentParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, parsed.data.id));
  if (!student) return res.status(404).json({ error: "Not found" });
  return res.json(toStudentResponse(student));
});

router.patch("/students/:id", async (req, res) => {
  const paramsParsed = UpdateStudentParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = UpdateStudentBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid body" });

  const { dateOfBirth: dob, ...updateData } = bodyParsed.data;
  const [student] = await db
    .update(studentsTable)
    .set({
      ...updateData,
      dateOfBirth: dob instanceof Date ? dob.toISOString().split("T")[0] : (dob ?? null),
    })
    .where(eq(studentsTable.id, paramsParsed.data.id))
    .returning();
  if (!student) return res.status(404).json({ error: "Not found" });
  return res.json(toStudentResponse(student));
});

router.delete("/students/:id", async (req, res) => {
  const parsed = DeleteStudentParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  await db.delete(studentsTable).where(eq(studentsTable.id, parsed.data.id));
  return res.status(204).send();
});

function toStudentResponse(s: typeof studentsTable.$inferSelect) {
  return {
    ...s,
    attendancePercent: Number(s.attendancePercent),
    punctualityPercent: Number(s.punctualityPercent),
    createdAt: s.createdAt.toISOString(),
  };
}

export default router;
