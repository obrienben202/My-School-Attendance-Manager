import { Router } from "express";
import { db } from "@workspace/db";
import { targetsTable, studentsTable } from "@workspace/db";
import { eq, and, lt, type SQL } from "drizzle-orm";
import {
  ListTargetsQueryParams,
  CreateTargetBody,
  UpdateTargetParams,
  UpdateTargetBody,
  DeleteTargetParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/targets", async (req, res) => {
  const parsed = ListTargetsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query params" });

  const { studentId, overdue } = parsed.data;
  const today = new Date().toISOString().split("T")[0];

  const conditions: SQL[] = [];
  if (studentId) conditions.push(eq(targetsTable.studentId, studentId));

  const records = await db
    .select({
      id: targetsTable.id,
      studentId: targetsTable.studentId,
      title: targetsTable.title,
      description: targetsTable.description,
      dueDate: targetsTable.dueDate,
      completed: targetsTable.completed,
      createdAt: targetsTable.createdAt,
      studentName: studentsTable.forename,
      studentSurname: studentsTable.surname,
    })
    .from(targetsTable)
    .leftJoin(studentsTable, eq(targetsTable.studentId, studentsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(targetsTable.dueDate);

  const mapped = records.map(r => {
    const isOverdue = !r.completed && r.dueDate !== null && r.dueDate < today;
    return {
      id: r.id,
      studentId: r.studentId,
      studentName: r.studentName && r.studentSurname
        ? `${r.studentName} ${r.studentSurname}`
        : r.studentName ?? null,
      title: r.title,
      description: r.description ?? null,
      dueDate: r.dueDate ?? null,
      completed: r.completed,
      overdue: isOverdue,
      createdAt: r.createdAt.toISOString(),
    };
  });

  if (overdue !== undefined) {
    return res.json(mapped.filter(t => t.overdue === overdue));
  }
  return res.json(mapped);
});

router.post("/targets", async (req, res) => {
  const parsed = CreateTargetBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [target] = await db.insert(targetsTable).values(parsed.data).returning();
  return res.status(201).json({
    ...target,
    studentName: null,
    overdue: false,
    dueDate: target.dueDate ?? null,
    description: target.description ?? null,
    createdAt: target.createdAt.toISOString(),
  });
});

router.patch("/targets/:id", async (req, res) => {
  const paramsParsed = UpdateTargetParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = UpdateTargetBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid body" });

  const [target] = await db
    .update(targetsTable)
    .set(bodyParsed.data)
    .where(eq(targetsTable.id, paramsParsed.data.id))
    .returning();
  if (!target) return res.status(404).json({ error: "Not found" });

  const today = new Date().toISOString().split("T")[0];
  const isOverdue = !target.completed && target.dueDate !== null && target.dueDate < today;

  return res.json({
    ...target,
    studentName: null,
    overdue: isOverdue,
    dueDate: target.dueDate ?? null,
    description: target.description ?? null,
    createdAt: target.createdAt.toISOString(),
  });
});

router.delete("/targets/:id", async (req, res) => {
  const parsed = DeleteTargetParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  await db.delete(targetsTable).where(eq(targetsTable.id, parsed.data.id));
  return res.status(204).send();
});

export default router;
