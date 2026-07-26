import { Router } from "express";
import { db } from "@workspace/db";
import { scheduleTable, coursesTable, usersTable, staffTimetableTable } from "@workspace/db";
import { eq, ilike, or, isNull, isNotNull } from "drizzle-orm";

const router = Router();

// ── Unified slot type returned to the client ──────────────────────────────────
// type: "course"    → linked to a course in the courses table (schedule rows)
// type: "personal"  → personal/shared staff timetable entry (staff_timetable_slots rows)

// GET /hod/department-timetable
router.get("/hod/department-timetable", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
  const u = req.user as {
    id?: string; role?: string; department?: string;
    firstName?: string; lastName?: string; name?: string;
  } | undefined;
  const role = u?.role;
  if (role !== "admin" && role !== "hod") {
    return res.status(403).json({ error: "Admin or Head of Department access required" });
  }

  // ── 1. Course-based slots (schedule → courses) ────────────────────────────
  let courseRows: typeof scheduleTable.$inferSelect[] & { courseCode: string; courseName: string; staffName: string | null; yearGroup: string | null; headOfDepartment: string | null }[] = [];

  const courseQuery = db
    .select({
      slotId:          scheduleTable.id,
      day:             scheduleTable.day,
      lessonNumber:    scheduleTable.lessonNumber ?? null,
      startTime:       scheduleTable.startTime,
      endTime:         scheduleTable.endTime,
      room:            scheduleTable.room,
      weekPattern:     scheduleTable.weekPattern,
      courseId:        coursesTable.id,
      courseCode:      coursesTable.code,
      courseName:      coursesTable.name,
      staffName:       coursesTable.staffName,
      yearGroup:       coursesTable.yearGroup,
      headOfDepartment: coursesTable.headOfDepartment,
    })
    .from(scheduleTable)
    .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id));

  const rawCourseRows = role === "admin"
    ? await courseQuery.orderBy(scheduleTable.day, scheduleTable.startTime)
    : await (async () => {
        const dept     = u?.department ?? "";
        const fullName = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.name || "";
        if (!dept && !fullName) {
          return courseQuery.orderBy(scheduleTable.day, scheduleTable.startTime);
        }
        const conditions = [];
        if (dept)     conditions.push(ilike(coursesTable.headOfDepartment, `%${dept}%`));
        if (fullName) conditions.push(ilike(coursesTable.headOfDepartment, `%${fullName}%`));
        return courseQuery.where(or(...conditions)).orderBy(scheduleTable.day, scheduleTable.startTime);
      })();

  const courseSlots = rawCourseRows.map(r => ({
    type:        "course" as const,
    slotId:      r.slotId,
    day:         r.day ?? "Monday",
    lessonNumber: null as number | null,
    startTime:   r.startTime,
    endTime:     r.endTime,
    room:        r.room ?? null,
    weekPattern: r.weekPattern,
    description: r.courseName,
    groupLabel:  null as string | null,
    staffName:   r.staffName ?? null,
    isHodShared: false,
    courseId:    r.courseId,
    courseCode:  r.courseCode,
    courseName:  r.courseName,
    yearGroup:   r.yearGroup ?? null,
  }));

  // ── 2. Personal / shared staff timetable slots ────────────────────────────
  // Always include is_hod_shared = true (Morning Meetings etc.)
  // Plus all personal rows for staff whose name matches an active HoD user in this department.

  // Fetch all HoD users so we know which staff names to include
  const hodUsers = await db
    .select({ firstName: usersTable.firstName, lastName: usersTable.lastName, department: usersTable.department })
    .from(usersTable)
    .where(eq(usersTable.role, "hod"));

  const hodNames = hodUsers.map(u =>
    [u.firstName, u.lastName].filter(Boolean).join(" ")
  ).filter(Boolean);

  // Get all personal slots from staff_timetable_slots
  const allPersonal = await db
    .select()
    .from(staffTimetableTable)
    .orderBy(staffTimetableTable.day, staffTimetableTable.lessonNumber);

  const personalSlots = allPersonal
    .filter(row => {
      if (row.isHodShared) return true;               // always include shared
      if (!row.staffName) return false;
      // include if the staff member is a known HoD
      return hodNames.some(n => n.toLowerCase() === row.staffName!.toLowerCase());
    })
    .map(row => ({
      type:        "personal" as const,
      slotId:      row.id,
      day:         row.day,
      lessonNumber: row.lessonNumber,
      startTime:   row.startTime,
      endTime:     row.endTime,
      room:        row.room ?? null,
      weekPattern: "Every week",
      description: row.description,
      groupLabel:  row.groupLabel ?? null,
      staffName:   row.staffName ?? null,   // null = shared HoD entry
      isHodShared: row.isHodShared,
      courseId:    null as number | null,
      courseCode:  null as string | null,
      courseName:  null as string | null,
      yearGroup:   null as string | null,
    }));

  return res.json([...courseSlots, ...personalSlots]);
});

export default router;
