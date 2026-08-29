import { Router } from "express";
import { db } from "@workspace/db";
import { scheduleTable, coursesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getScheduleDayIndex } from "../lib/schedule-day";

const router = Router();

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getLessonOccurrenceDate(day: string | null, referenceDate = new Date()) {
  const targetDay = getScheduleDayIndex(day);
  if (targetDay === undefined) return formatDate(referenceDate);

  const occurrenceDate = new Date(referenceDate);
  const daysSinceOccurrence = (referenceDate.getDay() - targetDay + 7) % 7;
  occurrenceDate.setDate(referenceDate.getDate() - daysSinceOccurrence);
  return formatDate(occurrenceDate);
}

router.get("/schedule/today", async (_req, res) => {
  const records = await db
    .select({
      id: scheduleTable.id,
      courseId: scheduleTable.courseId,
      startTime: scheduleTable.startTime,
      endTime: scheduleTable.endTime,
      room: scheduleTable.room,
      staffName: scheduleTable.staffName,
      day: scheduleTable.day,
      registerMarked: scheduleTable.registerMarked,
      courseCode: coursesTable.code,
      courseName: coursesTable.name,
    })
    .from(scheduleTable)
    .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
    .where(eq(coursesTable.isActive, true))
    .orderBy(scheduleTable.startTime);

  return res.json(records.map(r => ({
    id: r.id,
    courseId: r.courseId,
    startTime: r.startTime,
    endTime: r.endTime,
    courseCode: r.courseCode ?? "",
    courseName: r.courseName ?? "",
    room: r.room ?? null,
    staffName: r.staffName ?? null,
    day: r.day ?? null,
    occurrenceDate: getLessonOccurrenceDate(r.day),
    registerMarked: r.registerMarked,
  })));
});

export default router;
