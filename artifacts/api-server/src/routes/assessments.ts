import { Router } from "express";
import { db } from "@workspace/db";
import { assessmentsTable, assessmentResultsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/assessments", async (req, res) => {
  const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
  const rows = courseId
    ? await db.select().from(assessmentsTable).where(eq(assessmentsTable.courseId, courseId)).orderBy(assessmentsTable.order)
    : await db.select().from(assessmentsTable).orderBy(assessmentsTable.order);
  return res.json(rows.map(toResponse));
});

router.post("/assessments", async (req, res) => {
  const { courseId, code, description, type, dueDate, gradingScheme, minPassMark, marksOutOf, active, order, location, organisation, mandatory, allowAegrotats } = req.body;
  if (!courseId || !code || !description) return res.status(400).json({ error: "courseId, code and description are required" });
  const [row] = await db.insert(assessmentsTable).values({
    courseId: Number(courseId), code, description,
    type: type ?? "Assignment",
    dueDate: dueDate ?? null,
    gradingScheme: gradingScheme ?? "Percentage",
    minPassMark: minPassMark ?? null,
    marksOutOf: marksOutOf ? Number(marksOutOf) : null,
    active: active !== undefined ? Number(active) : 1,
    order: order ? Number(order) : 1,
    location: location ?? null,
    organisation: organisation ?? null,
    mandatory: mandatory !== undefined ? Number(mandatory) : 0,
    allowAegrotats: allowAegrotats !== undefined ? Number(allowAegrotats) : 0,
  }).returning();
  return res.status(201).json(toResponse(row));
});

router.get("/assessments/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(toResponse(row));
});

router.patch("/assessments/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db.update(assessmentsTable).set(req.body).where(eq(assessmentsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(toResponse(row));
});

router.delete("/assessments/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  await db.delete(assessmentsTable).where(eq(assessmentsTable.id, id));
  return res.status(204).send();
});

router.get("/assessment-results", async (req, res) => {
  const assessmentId = req.query.assessmentId ? Number(req.query.assessmentId) : undefined;
  const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
  let query = db.select().from(assessmentResultsTable);
  if (assessmentId && studentId) {
    const rows = await db.select().from(assessmentResultsTable)
      .where(and(eq(assessmentResultsTable.assessmentId, assessmentId), eq(assessmentResultsTable.studentId, studentId)));
    return res.json(rows.map(toResultResponse));
  } else if (assessmentId) {
    const rows = await db.select().from(assessmentResultsTable).where(eq(assessmentResultsTable.assessmentId, assessmentId));
    return res.json(rows.map(toResultResponse));
  } else if (studentId) {
    const rows = await db.select().from(assessmentResultsTable).where(eq(assessmentResultsTable.studentId, studentId));
    return res.json(rows.map(toResultResponse));
  }
  const rows = await db.select().from(assessmentResultsTable);
  return res.json(rows.map(toResultResponse));
});

router.post("/assessment-results", async (req, res) => {
  const { assessmentId, studentId, result, adjustedResult, attempt, reasonForZeroMark, mitigatingCircs, dateSubmitted, dateMarked, confirmed, status } = req.body;
  if (!assessmentId || !studentId) return res.status(400).json({ error: "assessmentId and studentId are required" });
  const [row] = await db.insert(assessmentResultsTable).values({
    assessmentId: Number(assessmentId),
    studentId: Number(studentId),
    result: result ?? null,
    adjustedResult: adjustedResult ?? null,
    attempt: attempt ? Number(attempt) : 1,
    reasonForZeroMark: reasonForZeroMark ?? null,
    mitigatingCircs: mitigatingCircs ?? null,
    dateSubmitted: dateSubmitted ?? null,
    dateMarked: dateMarked ?? null,
    confirmed: confirmed !== undefined ? Number(confirmed) : 0,
    status: status ?? "Not Marked",
  }).returning();
  return res.status(201).json(toResultResponse(row));
});

router.patch("/assessment-results/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db.update(assessmentResultsTable).set(req.body).where(eq(assessmentResultsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(toResultResponse(row));
});

function toResponse(r: typeof assessmentsTable.$inferSelect) {
  return { ...r, createdAt: r.createdAt.toISOString() };
}
function toResultResponse(r: typeof assessmentResultsTable.$inferSelect) {
  return { ...r, createdAt: r.createdAt.toISOString() };
}

export default router;
