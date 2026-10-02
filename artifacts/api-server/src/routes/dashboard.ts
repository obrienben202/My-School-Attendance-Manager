import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable, attendanceTable, targetsTable, ilpsTable, scheduleTable } from "@workspace/db";
import { and, eq, count, avg } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const [studentsResult] = await db.select({ total: count() }).from(studentsTable);
  const [atRiskResult] = await db
    .select({ total: count() })
    .from(studentsTable)
    .where(eq(studentsTable.atRisk, true));
  const [ilpsResult] = await db.select({ total: count() }).from(ilpsTable);
  const [overdueTargets] = await db
    .select({ total: count() })
    .from(targetsTable)
    .where(eq(targetsTable.completed, false));
  const [registersResult] = await db
    .select({ total: count() })
    .from(scheduleTable)
    .where(and(eq(scheduleTable.registerMarked, false), eq(scheduleTable.isActive, true)));

  const [avgAttendance] = await db
    .select({ avg: avg(studentsTable.attendancePercent) })
    .from(studentsTable);
  const [avgPunctuality] = await db
    .select({ avg: avg(studentsTable.punctualityPercent) })
    .from(studentsTable);

  return res.json({
    attendancePercent: Number(avgAttendance.avg ?? 0),
    punctualityPercent: Number(avgPunctuality.avg ?? 0),
    registersCount: registersResult.total,
    atRiskCount: atRiskResult.total,
    smartTargetsCount: overdueTargets.total,
    ilpsCount: ilpsResult.total,
  });
});

export default router;
