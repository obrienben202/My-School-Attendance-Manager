import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { coursesTable, studentsTable, enrollmentsTable, scheduleTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  GetCourseParams,
  GetCourseResponse,
  ListCoursesResponse,
} from "@workspace/api-zod";
import { requireAdminOrHod } from "./auth";
import { canManageAttendanceSchedule } from "../lib/attendance-authorization";
import { CreateSlotBody, UpdateSlotBody } from "../lib/manual-slot-validation";

const router = Router();
const roleFixturePrefix = "__e2e_course_slots_";
const roleFixtureStatus = "e2e-role-fixture";

function isRoleFixture(course: typeof coursesTable.$inferSelect) {
  return !course.isActive && course.sourceId === null &&
    course.status === roleFixtureStatus && course.code.startsWith(roleFixturePrefix);
}

async function slotCourseAvailable(id: number, req: { isAuthenticated(): boolean; user?: unknown }) {
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, id));
  return course && (
    course.isActive ||
    (process.env.NODE_ENV === "development" && isRoleFixture(course) &&
      req.isAuthenticated() && (req.user as { role?: string } | undefined)?.role === "admin")
  ) ? course : null;
}

// An inactive, unassigned course keeps role checks out of all normal course and timetable feeds.
// This route is never registered in production.
if (process.env.NODE_ENV === "development") {
  router.post("/__e2e/course-slots-fixture", async (req, res) => {
    if (!requireAdminOrHod(req, res)) return;
    if ((req.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Admin access required" });
    const [course] = await db.insert(coursesTable).values({
      code: `${roleFixturePrefix}${randomUUID()}`,
      name: "E2E role check fixture",
      status: roleFixtureStatus,
      isActive: false,
    }).returning({ id: coursesTable.id });
    return res.status(201).json(course);
  });

  router.delete("/__e2e/course-slots-fixture/:id", async (req, res) => {
    if (!requireAdminOrHod(req, res)) return;
    if ((req.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Admin access required" });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, id));
    if (!course || !isRoleFixture(course)) return res.status(404).json({ error: "Fixture not found" });
    await db.delete(coursesTable).where(and(
      eq(coursesTable.id, id),
      eq(coursesTable.code, course.code),
      eq(coursesTable.isActive, false),
    ));
    return res.status(204).send();
  });
}

router.get("/courses", async (_req, res) => {
  const courses = await db.select().from(coursesTable)
    .where(eq(coursesTable.isActive, true))
    .orderBy(coursesTable.name);
  return res.json(ListCoursesResponse.parse(courses.map(toCourseResponse)));
});

router.get("/courses/:id", async (req, res) => {
  const parsed = GetCourseParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const [course] = await db.select().from(coursesTable).where(
    and(eq(coursesTable.id, parsed.data.id), eq(coursesTable.isActive, true)),
  );
  if (!course) return res.status(404).json({ error: "Not found" });
  return res.json(GetCourseResponse.parse(toCourseResponse(course)));
});

// GET /courses/:id/students — returns students actually enrolled in this course
router.get("/courses/:id/students", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [course] = await db.select({
    id: coursesTable.id,
    staffName: coursesTable.staffName,
  }).from(coursesTable).where(
    and(eq(coursesTable.id, id), eq(coursesTable.isActive, true)),
  );
  if (!course) return res.status(404).json({ error: "Course not found" });
  if (!canManageAttendanceSchedule(req.user, {
    scheduleStaffName: null,
    courseStaffName: course.staffName,
  })) {
    res.status(403).json({ error: "You are not assigned to this course" });
    return;
  }

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

// GET /courses/:id/slots
router.get("/courses/:id/slots", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  if (!await slotCourseAvailable(id, req)) return res.status(404).json({ error: "Course not found" });
  const slots = await db.select().from(scheduleTable).where(eq(scheduleTable.courseId, id)).orderBy(scheduleTable.day, scheduleTable.startTime);
  return res.json(slots);
});

// POST /courses/:id/slots  (admin / hod only)
router.post("/courses/:id/slots", async (req, res) => {
  if (!requireAdminOrHod(req, res)) return;
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const course = await slotCourseAvailable(id, req);
  if (!course) return res.status(404).json({ error: "Course not found" });
  const parsed = CreateSlotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  const [slot] = await db.insert(scheduleTable).values({
    courseId: id, ...parsed.data,
    // The dashboard counts unmarked slots without filtering inactive courses.
    ...(!course.isActive ? { registerMarked: true } : {}),
  }).returning();
  return res.status(201).json(slot);
});

// PUT /courses/:id/slots/:slotId  (admin / hod only)
router.put("/courses/:id/slots/:slotId", async (req, res) => {
  if (!requireAdminOrHod(req, res)) return;
  const id = Number(req.params.id);
  const slotId = Number(req.params.slotId);
  if (isNaN(id) || isNaN(slotId)) return res.status(400).json({ error: "Invalid id" });
  if (!await slotCourseAvailable(id, req)) return res.status(404).json({ error: "Course not found" });
  const parsed = UpdateSlotBody.safeParse(req.body);
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
router.delete("/courses/:id/slots/:slotId", async (req, res) => {
  if (!requireAdminOrHod(req, res)) return;
  const id = Number(req.params.id);
  const slotId = Number(req.params.slotId);
  if (isNaN(id) || isNaN(slotId)) return res.status(400).json({ error: "Invalid id" });
  if (!await slotCourseAvailable(id, req)) return res.status(404).json({ error: "Course not found" });
  await db.delete(scheduleTable).where(and(eq(scheduleTable.id, slotId), eq(scheduleTable.courseId, id)));
  return res.status(204).send();
});

function toCourseResponse(c: typeof coursesTable.$inferSelect) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    room: c.room,
    staffName: c.staffName,
    headOfDepartment: c.headOfDepartment,
    yearGroup: c.yearGroup,
    enrolledCount: c.enrolledCount,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

export default router;
