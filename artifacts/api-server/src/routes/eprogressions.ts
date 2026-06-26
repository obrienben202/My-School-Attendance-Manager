import { Router } from "express";
import { db } from "@workspace/db";
import { eprogressionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/eprogressions", async (req, res) => {
  const { studentId, courseId, status } = req.query as {
    studentId?: string;
    courseId?: string;
    status?: string;
  };

  let rows = await db
    .select()
    .from(eprogressionsTable)
    .orderBy(eprogressionsTable.submittedAt);

  if (studentId) rows = rows.filter((r) => r.studentId === Number(studentId));
  if (courseId) rows = rows.filter((r) => r.courseId === Number(courseId));
  if (status) rows = rows.filter((r) => r.status === status);

  res.json(rows);
});

router.post("/eprogressions", async (req, res) => {
  const [row] = await db.insert(eprogressionsTable).values(req.body).returning();
  res.status(201).json(row);
});

router.patch("/eprogressions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db
    .update(eprogressionsTable)
    .set(req.body)
    .where(eq(eprogressionsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/eprogressions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(eprogressionsTable).where(eq(eprogressionsTable.id, id));
  res.status(204).send();
});

export default router;
