import { Router, type IRouter, type Request, type Response } from "express";
import { runSync, getSyncState } from "../lib/sheet-sync";
import { db, studentsTable, coursesTable, attendanceTable, kpiBenchmarksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function requireAdminOrHod(req: Request, res: Response): boolean {
  const u = req.user as { role?: string } | undefined;
  if (!req.isAuthenticated() || (u?.role !== "admin" && u?.role !== "hod")) {
    res.status(403).json({ error: "Admin or HoD access required" });
    return false;
  }
  return true;
}

function requireAdmin(req: Request, res: Response): boolean {
  const u = req.user as { role?: string } | undefined;
  if (!req.isAuthenticated() || u?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// GET /admin/sync/status — counts + last sync time + KPI benchmarks
router.get("/admin/sync/status", async (req, res) => {
  if (!requireAdminOrHod(req, res)) return;

  const [studentCount, courseCount, attendanceCount, kpis] = await Promise.all([
    db.$count(studentsTable),
    db.$count(coursesTable, eq(coursesTable.isActive, true)),
    db.$count(attendanceTable),
    db.select().from(kpiBenchmarksTable).orderBy(kpiBenchmarksTable.category, kpiBenchmarksTable.lowerPercent),
  ]);

  const { lastRanAt, lastSummary, lastError, running } = getSyncState();

  return res.json({
    counts: { students: studentCount, courses: courseCount, attendance: attendanceCount },
    kpiBenchmarks: kpis,
    lastRanAt: lastRanAt?.toISOString() ?? null,
    lastSummary,
    lastError,
    running,
  });
});

// POST /admin/sync/sheets — manual trigger (admin only because it reconciles users)
router.post("/admin/sync/sheets", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const summary = await runSync();
    return res.json({ ok: true, summary });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
