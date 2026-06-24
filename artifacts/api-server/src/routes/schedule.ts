import { Router } from "express";
import { db } from "@workspace/db";
import { scheduleTable, coursesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/schedule/today", async (_req, res) => {
  const records = await db
    .select({
      id: scheduleTable.id,
      startTime: scheduleTable.startTime,
      endTime: scheduleTable.endTime,
      room: scheduleTable.room,
      staffName: scheduleTable.staffName,
      registerMarked: scheduleTable.registerMarked,
      courseId: coursesTable.id,
      courseCode: coursesTable.code,
      courseName: coursesTable.name,
    })
    .from(scheduleTable)
    .leftJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
    .orderBy(scheduleTable.startTime);

  return res.json(records.map(r => ({
    id: r.id,
    startTime: r.startTime,
    endTime: r.endTime,
    courseCode: r.courseCode ?? "",
    courseName: r.courseName ?? "",
    room: r.room ?? null,
    staffName: r.staffName ?? null,
    registerMarked: r.registerMarked,
  })));
});

export default router;
