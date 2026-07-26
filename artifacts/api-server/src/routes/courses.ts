import { Router } from "express";
import { db } from "@workspace/db";
import { coursesTable, studentsTable, enrollmentsTable, scheduleTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateCourseBody,
  GetCourseParams,
  CreateTimetableSlotBody,
} from "@workspace/api-zod";
import { requireAdminOrHod } from "./auth";

const router = Router();

router.get("/courses", async (_req, res) => {
  const courses = await db.select().from(coursesTable).orderBy(coursesTable.name);
  return res.json(courses.map(toCourseResponse));
});

router.post("/courses", async (req, res) => {
  const parsed = CreateCourseBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [course] = await db.insert(coursesTable).values(parsed.data).returning();
  return res.status(201).json(toCourseResponse(course));
});

router.get("/courses/:id", async (req, res) => {
  const parsed = GetCourseParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, parsed.data.id));
  if (!course) return res.status(404).json({ error: "Not found" });
  return res.json(toCourseResponse(course));
});

// GET /courses/:id/students — returns students actually enrolled in this course
router.get("/courses/:id/students", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const rows = await db
    .select({
      id: studentsTable.id,
      personCode: studentsTable.personCode,
      forename: studentsTable.forename,
      surname: studentsTable.surname,
      gender: studentsTable.gender,
      yearGroup: studentsTable.yearGroup,
      formGroup: studentsTable.formGroup,
      attendancePercent: studentsTable.attendancePercent,
      punctualityPercent: studentsTable.punctualityPercent,
      atRisk: studentsTable.atRisk,
    })
    .from(enrollmentsTable)
    .innerJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .where(eq(enrollmentsTable.courseId, id))
    .orderBy(studentsTable.surname, studentsTable.forename);

  return res.json(rows.map(r => ({
    ...r,
    attendancePercent: Number(r.attendancePercent),
    punctualityPercent: Number(r.punctualityPercent),
  })));
});

// ── Timetable Slots ──────────────────────────────────────────────────────────

const SlotBody = CreateTimetableSlotBody;

// GET /courses/:id/slots
router.get("/courses/:id/slots", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const slots = await db.select().from(scheduleTable).where(eq(scheduleTable.courseId, id)).orderBy(scheduleTable.day, scheduleTable.startTime);
  return res.json(slots);
});

// POST /courses/:id/slots  (admin / hod only)
router.post("/courses/:id/slots", requireAdminOrHod, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = SlotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  const [slot] = await db.insert(scheduleTable).values({ courseId: id, ...parsed.data }).returning();
  return res.status(201).json(slot);
});

// PUT /courses/:id/slots/:slotId  (admin / hod only)
router.put("/courses/:id/slots/:slotId", requireAdminOrHod, async (req, res) => {
  const id = Number(req.params.id);
  const slotId = Number(req.params.slotId);
  if (isNaN(id) || isNaN(slotId)) return res.status(400).json({ error: "Invalid id" });
  const parsed = SlotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  const [slot] = await db
    .update(scheduleTable)
    .set(parsed.data)
    .where(and(eq(scheduleTable.id, slotId), eq(scheduleTable.courseId, id)))
    .returning();
  if (!slot) return res.status(404).json({ error: "Slot not found" });
  return res.json(slot);
});

// DELETE /courses/:id/slots/:slotId  (admin / hod only)
router.delete("/courses/:id/slots/:slotId", requireAdminOrHod, async (req, res) => {
  const id = Number(req.params.id);
  const slotId = Number(req.params.slotId);
  if (isNaN(id) || isNaN(slotId)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(scheduleTable).where(and(eq(scheduleTable.id, slotId), eq(scheduleTable.courseId, id)));
  return res.status(204).send();
});

function toCourseResponse(c: typeof coursesTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
  };
}

export default router;
