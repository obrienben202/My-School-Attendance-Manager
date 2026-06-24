import { Router } from "express";
import { db } from "@workspace/db";
import { ilpsTable, studentsTable } from "@workspace/db";
import { eq, and, type SQL } from "drizzle-orm";
import {
  ListIlpsQueryParams,
  CreateIlpBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/ilps", async (req, res) => {
  const parsed = ListIlpsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query params" });

  const { studentId } = parsed.data;
  const conditions: SQL[] = [];
  if (studentId) conditions.push(eq(ilpsTable.studentId, studentId));

  const records = await db
    .select({
      id: ilpsTable.id,
      studentId: ilpsTable.studentId,
      title: ilpsTable.title,
      content: ilpsTable.content,
      status: ilpsTable.status,
      createdAt: ilpsTable.createdAt,
      studentForename: studentsTable.forename,
      studentSurname: studentsTable.surname,
    })
    .from(ilpsTable)
    .leftJoin(studentsTable, eq(ilpsTable.studentId, studentsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(ilpsTable.createdAt);

  return res.json(records.map(r => ({
    id: r.id,
    studentId: r.studentId,
    studentName: r.studentForename && r.studentSurname
      ? `${r.studentForename} ${r.studentSurname}`
      : r.studentForename ?? null,
    title: r.title,
    content: r.content ?? null,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/ilps", async (req, res) => {
  const parsed = CreateIlpBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [ilp] = await db.insert(ilpsTable).values(parsed.data).returning();
  return res.status(201).json({
    ...ilp,
    studentName: null,
    content: ilp.content ?? null,
    createdAt: ilp.createdAt.toISOString(),
  });
});

export default router;
