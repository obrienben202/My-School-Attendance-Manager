import { Router } from "express";
import { db } from "@workspace/db";
import { scheduleTable, coursesTable, usersTable, staffTimetableTable } from "@workspace/db";
import { and, eq, ilike, or, inArray } from "drizzle-orm";
import { buildMyTimetable } from "../lib/my-timetable";

const router = Router();

/** Strip honourifics so "Mr Ben O'Brien" → "ben o'brien" for matching */
function stripTitle(name: string): string {
  return name.replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, "").trim().toLowerCase();
}

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

  // ── 1. Determine which department we're scoping to ────────────────────────
  const myDept = u?.department ?? "";

  // ── 2. Course-based timetable slots (schedule → courses) ──────────────────
  const courseQuery = db
    .select({
      slotId:           scheduleTable.id,
      day:              scheduleTable.day,
      startTime:        scheduleTable.startTime,
      endTime:          scheduleTable.endTime,
      room:             scheduleTable.room,
      slotStaffName:    scheduleTable.staffName,
      weekPattern:      scheduleTable.weekPattern,
      courseId:         coursesTable.id,
      courseCode:       coursesTable.code,
      courseName:       coursesTable.name,
      staffName:        coursesTable.staffName,
      yearGroup:        coursesTable.yearGroup,
      headOfDepartment: coursesTable.headOfDepartment,
    })
    .from(scheduleTable)
    .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id));

  let rawCourseRows;
  if (role === "admin") {
    rawCourseRows = await courseQuery
      .where(eq(coursesTable.isActive, true))
      .orderBy(scheduleTable.day, scheduleTable.startTime);
  } else {
    const fullName = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.name || "";
    const conditions: ReturnType<typeof ilike>[] = [];
    if (myDept)   conditions.push(ilike(coursesTable.headOfDepartment, `%${myDept}%`));
    if (fullName) conditions.push(ilike(coursesTable.headOfDepartment, `%${fullName}%`));
    rawCourseRows = conditions.length
      ? await courseQuery.where(and(eq(coursesTable.isActive, true), or(...conditions))).orderBy(scheduleTable.day, scheduleTable.startTime)
      : await courseQuery.where(eq(coursesTable.isActive, true)).orderBy(scheduleTable.day, scheduleTable.startTime);
  }

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
    staffName:   r.slotStaffName ?? r.staffName ?? null,
    isHodShared: false,
    courseId:    r.courseId,
    courseCode:  r.courseCode,
    courseName:  r.courseName,
    yearGroup:   r.yearGroup ?? null,
  }));

  // ── 3. Personal / shared timetable slots ──────────────────────────────────
  // Find ALL users in the same department (any role) so we include dept staff,
  // not just HoDs. For admin, include everyone who has personal slots.
  const deptUsers = role === "admin"
    ? await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable)
    : await db
        .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable)
        .where(myDept ? ilike(usersTable.department, myDept) : eq(usersTable.role, "hod"));

  // Build a set of stripped name patterns from the DB users
  const namePatterns = deptUsers
    .map(u => [u.firstName, u.lastName].filter(Boolean).join(" ").toLowerCase())
    .filter(Boolean);

  // Fetch all personal/shared slots
  const allPersonal = await db
    .select()
    .from(staffTimetableTable)
    .orderBy(staffTimetableTable.day, staffTimetableTable.lessonNumber);

  const personalSlots = allPersonal
    .filter(row => {
      if (row.isHodShared) return true;                  // always show shared HoD entries
      if (!row.staffName)  return false;
      const stripped = stripTitle(row.staffName);        // e.g. "ben o'brien"
      // Match if any dept user's name contains or equals the stripped timetable name
      return namePatterns.some(n => {
        const strippedN = stripTitle(n);
        return strippedN === stripped ||
               strippedN.includes(stripped) ||
               stripped.includes(strippedN);
      });
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
      staffName:   row.staffName ?? null,
      isHodShared: row.isHodShared,
      courseId:    null as number | null,
      courseCode:  null as string | null,
      courseName:  null as string | null,
      yearGroup:   null as string | null,
    }));

  return res.json([...courseSlots, ...personalSlots]);
});

// GET /staff/my-timetable — personal timetable for the logged-in user
router.get("/staff/my-timetable", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });

  const u = req.user as {
    firstName?: string; lastName?: string; name?: string; username?: string; role?: string;
  } | undefined;

  const fullName = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.name || u?.username || "";
  const [courseSlots, staffSlots] = await Promise.all([
    db.select({
      id: scheduleTable.id,
      day: scheduleTable.day,
      startTime: scheduleTable.startTime,
      endTime: scheduleTable.endTime,
      room: scheduleTable.room,
      weekPattern: scheduleTable.weekPattern,
      scheduleStaffName: scheduleTable.staffName,
      courseStaffName: coursesTable.staffName,
      courseName: coursesTable.name,
      courseCode: coursesTable.code,
    }).from(scheduleTable)
      .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
      .where(eq(coursesTable.isActive, true)),
    db.select().from(staffTimetableTable),
  ]);

  // Match against the authenticated identity, never a staff name supplied by the client.
  res.set("Cache-Control", "private, no-store");
  return res.json(buildMyTimetable(courseSlots, staffSlots, fullName, u?.role));
});

export default router;
