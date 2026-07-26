import { Router } from "express";
import { db } from "@workspace/db";
import { scheduleTable, coursesTable, usersTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";

const router = Router();

// GET /hod/department-timetable
// Admin → all courses. HoD → courses where headOfDepartment matches their department or name.
router.get("/hod/department-timetable", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
  const u = req.user as { id?: string; role?: string; department?: string; firstName?: string; lastName?: string } | undefined;
  const role = u?.role;
  if (role !== "admin" && role !== "hod") {
    return res.status(403).json({ error: "Admin or Head of Department access required" });
  }

  // Build the query: join schedule → course, pull all slots
  const baseQuery = db
    .select({
      slotId: scheduleTable.id,
      day: scheduleTable.day,
      startTime: scheduleTable.startTime,
      endTime: scheduleTable.endTime,
      room: scheduleTable.room,
      weekPattern: scheduleTable.weekPattern,
      courseId: coursesTable.id,
      courseCode: coursesTable.code,
      courseName: coursesTable.name,
      staffName: coursesTable.staffName,
      yearGroup: coursesTable.yearGroup,
      headOfDepartment: coursesTable.headOfDepartment,
    })
    .from(scheduleTable)
    .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id));

  let rows;

  if (role === "admin") {
    rows = await baseQuery.orderBy(scheduleTable.day, scheduleTable.startTime);
  } else {
    // HoD: filter by their department or their own name
    const dept = u?.department ?? "";
    const fullName = [u?.firstName, u?.lastName].filter(Boolean).join(" ");

    if (!dept && !fullName) {
      // No department info on this HoD account — return all as a fallback
      rows = await baseQuery.orderBy(scheduleTable.day, scheduleTable.startTime);
    } else {
      const conditions = [];
      if (dept) conditions.push(ilike(coursesTable.headOfDepartment, `%${dept}%`));
      if (fullName) conditions.push(ilike(coursesTable.headOfDepartment, `%${fullName}%`));
      rows = await baseQuery
        .where(or(...conditions))
        .orderBy(scheduleTable.day, scheduleTable.startTime);
    }
  }

  return res.json(rows);
});

export default router;
