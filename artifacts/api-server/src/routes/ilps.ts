import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { ilpsTable, studentsTable } from "@workspace/db";
import { eq, and, type SQL } from "drizzle-orm";
import {
  ListIlpsQueryParams,
  CreateIlpBody,
  DeleteIlpParams,
  UpdateIlpBody,
  UpdateIlpParams,
} from "@workspace/api-zod";

const router = Router();
const MAINTAINER_ROLES = new Set(["staff", "hod", "admin"]);

router.use((req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });
  return next();
});

function requireMaintainer(req: Request, res: Response): boolean {
  if (!req.user || !MAINTAINER_ROLES.has(req.user.role)) {
    res.status(403).json({ error: "ILP maintenance access denied" });
    return false;
  }
  return true;
}

function dateOnly(value: Date | string | null | undefined): string | null | undefined {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

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
      tutor: ilpsTable.tutor,
      academicYear: ilpsTable.academicYear,
      lastReviewDate: ilpsTable.lastReviewDate,
      nextReviewDue: ilpsTable.nextReviewDue,
      sections: ilpsTable.sections,
      createdAt: ilpsTable.createdAt,
      updatedAt: ilpsTable.updatedAt,
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
    tutor: r.tutor,
    academicYear: r.academicYear,
    lastReviewDate: r.lastReviewDate,
    nextReviewDue: r.nextReviewDue,
    sections: r.sections,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.post("/ilps", async (req, res) => {
  if (!requireMaintainer(req, res)) return;
  const parsed = CreateIlpBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [ilp] = await db.insert(ilpsTable).values({
    ...parsed.data,
    lastReviewDate: dateOnly(parsed.data.lastReviewDate),
    nextReviewDue: dateOnly(parsed.data.nextReviewDue),
  }).returning();
  return res.status(201).json({
    ...ilp,
    studentName: null,
    content: ilp.content ?? null,
    createdAt: ilp.createdAt.toISOString(),
    updatedAt: ilp.updatedAt.toISOString(),
  });
});

router.patch("/ilps/:id", async (req, res) => {
  if (!requireMaintainer(req, res)) return;
  const params = UpdateIlpParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const parsed = UpdateIlpBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [ilp] = await db
    .update(ilpsTable)
    .set({
      ...parsed.data,
      lastReviewDate: dateOnly(parsed.data.lastReviewDate),
      nextReviewDue: dateOnly(parsed.data.nextReviewDue),
    })
    .where(eq(ilpsTable.id, params.data.id))
    .returning();
  if (!ilp) return res.status(404).json({ error: "Not found" });

  return res.json({
    ...ilp,
    studentName: null,
    content: ilp.content ?? null,
    createdAt: ilp.createdAt.toISOString(),
    updatedAt: ilp.updatedAt.toISOString(),
  });
});

router.delete("/ilps/:id", async (req, res) => {
  if (!requireMaintainer(req, res)) return;
  const params = DeleteIlpParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });

  const deleted = await db
    .delete(ilpsTable)
    .where(eq(ilpsTable.id, params.data.id))
    .returning({ id: ilpsTable.id });
  if (!deleted.length) return res.status(404).json({ error: "Not found" });
  return res.status(204).send();
});

export default router;
