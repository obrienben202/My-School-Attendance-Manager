import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { assessmentsTable, assessmentResultsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();
const MAINTAINER_ROLES = new Set(["staff", "hod", "admin"]);
const ASSESSMENT_UPDATE_FIELDS = new Set([
  "courseId", "code", "description", "type", "dueDate", "gradingScheme",
  "minPassMark", "marksOutOf", "active", "order", "location", "organisation",
  "mandatory", "allowAegrotats", "tutor",
]);
const RESULT_UPDATE_FIELDS = new Set([
  "assessmentId", "studentId", "result", "adjustedResult", "attempt",
  "reasonForZeroMark", "mitigatingCircs", "dateSubmitted", "dateMarked",
  "confirmed", "status",
]);

export function allowlistedUpdate(body: unknown, fields: ReadonlySet<string>): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  return Object.fromEntries(Object.entries(body).filter(([key]) => fields.has(key)));
}

router.use((req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });
  return next();
});

function requireMaintainer(req: Request, res: Response): boolean {
  if (!req.user || !MAINTAINER_ROLES.has(req.user.role)) {
    res.status(403).json({ error: "Assessment maintenance access denied" });
    return false;
  }
  return true;
}

function isReleasedStatus(status: unknown): boolean {
  return typeof status === "string" && status.trim().toLowerCase() === "released";
}

router.get("/assessments", async (req, res) => {
  const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
  const rows = courseId
    ? await db.select().from(assessmentsTable).where(eq(assessmentsTable.courseId, courseId)).orderBy(assessmentsTable.order)
    : await db.select().from(assessmentsTable).orderBy(assessmentsTable.order);
  return res.json(rows.map(toResponse));
});

router.post("/assessments", async (req, res) => {
  if (!requireMaintainer(req, res)) return;
  const { courseId, code, description, type, dueDate, gradingScheme, minPassMark, marksOutOf, active, order, location, organisation, mandatory, allowAegrotats, tutor } = req.body;
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
    tutor: typeof tutor === "string" && tutor.trim() ? tutor.trim() : null,
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
  if (!requireMaintainer(req, res)) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const update = {
    ...allowlistedUpdate(req.body, ASSESSMENT_UPDATE_FIELDS),
    ...(Object.hasOwn(req.body, "tutor")
      ? { tutor: typeof req.body.tutor === "string" && req.body.tutor.trim() ? req.body.tutor.trim() : null }
      : {}),
  };
  const [row] = await db.update(assessmentsTable).set(update).where(eq(assessmentsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(toResponse(row));
});

router.delete("/assessments/:id", async (req, res) => {
  if (!requireMaintainer(req, res)) return;
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
  if (!requireMaintainer(req, res)) return;
  const { assessmentId, studentId, result, adjustedResult, attempt, reasonForZeroMark, mitigatingCircs, dateSubmitted, dateMarked, confirmed, status } = req.body;
  if (!assessmentId || !studentId) return res.status(400).json({ error: "assessmentId and studentId are required" });
  const resultStatus = status ?? "Not Marked";
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
    status: resultStatus,
    gradeReleasedAt: isReleasedStatus(resultStatus) ? new Date() : null,
  }).returning();
  return res.status(201).json(toResultResponse(row));
});

router.patch("/assessment-results/:id", async (req, res) => {
  if (!requireMaintainer(req, res)) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const update = allowlistedUpdate(req.body, RESULT_UPDATE_FIELDS);
  if (Object.hasOwn(req.body, "status")) {
    if (isReleasedStatus(req.body.status)) {
      const [existing] = await db.select({ gradeReleasedAt: assessmentResultsTable.gradeReleasedAt })
        .from(assessmentResultsTable).where(eq(assessmentResultsTable.id, id));
      update.gradeReleasedAt = existing?.gradeReleasedAt ?? new Date();
    } else {
      update.gradeReleasedAt = null;
    }
  }
  const [row] = await db.update(assessmentResultsTable).set(update).where(eq(assessmentResultsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(toResultResponse(row));
});

function toResponse(r: typeof assessmentsTable.$inferSelect) {
  return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}
function toResultResponse(r: typeof assessmentResultsTable.$inferSelect) {
  return {
    ...r,
    gradeReleasedAt: r.gradeReleasedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export default router;
