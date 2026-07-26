import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db, studentsTable, coursesTable, attendanceTable, enrollmentsTable, kpiBenchmarksTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

const ATTENDANCE_SHEET_ID = "1eHSs1LPFM0cgMQQ4YWJQV2d20RSCm7-_xOCAWBfGLPQ";

function requireAdminOrHod(req: Request, res: Response): boolean {
  const u = req.user as { role?: string } | undefined;
  if (!req.isAuthenticated() || (u?.role !== "admin" && u?.role !== "hod")) {
    res.status(403).json({ error: "Admin or HoD access required" });
    return false;
  }
  return true;
}

async function fetchSheet(connectors: ReplitConnectors, spreadsheetId: string, sheetName: string): Promise<string[][]> {
  const range = encodeURIComponent(`'${sheetName}'!A1:Z2000`);
  const resp = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { method: "GET" }
  );
  const data = await resp.json() as { values?: string[][] };
  return data.values ?? [];
}

function parsePercent(val: string): string {
  return String(parseFloat(val.replace("%", "").trim()) || 0);
}

// POST /admin/sync/sheets
// Syncs students roster, attendance log, and KPI benchmarks from Google Sheets.
router.post("/admin/sync/sheets", async (req, res) => {
  if (!requireAdminOrHod(req, res)) return;

  try {
    const connectors = new ReplitConnectors();
    const summary: Record<string, { inserted: number; updated: number; skipped: number; errors: string[] }> = {};

    // ── 1. Students Roster ────────────────────────────────────────────────────
    const studentRows = await fetchSheet(connectors, ATTENDANCE_SHEET_ID, "Students Roster");
    if (studentRows.length > 1) {
      // Row 0 is header: Student ID, First Name, Last Name, Year Group, Form Group, Classes
      const dataRows = studentRows.slice(1).filter(r => r[0]?.trim());
      let inserted = 0, updated = 0, errors: string[] = [];

      for (const row of dataRows) {
        const [personCode, forename, surname, yearGroup, formGroup, classesRaw] = row.map(c => c?.trim() ?? "");
        if (!personCode || !forename || !surname) {
          errors.push(`Skipped incomplete row: ${JSON.stringify(row)}`);
          continue;
        }
        try {
          const existing = await db.select({ id: studentsTable.id })
            .from(studentsTable)
            .where(eq(studentsTable.personCode, personCode))
            .limit(1);

          if (existing.length > 0) {
            await db.update(studentsTable)
              .set({ forename, surname, yearGroup: yearGroup || null, formGroup: formGroup || null })
              .where(eq(studentsTable.personCode, personCode));
            updated++;
          } else {
            await db.insert(studentsTable).values({
              personCode,
              forename,
              surname,
              yearGroup: yearGroup || null,
              formGroup: formGroup || null,
            });
            inserted++;
          }

          // Handle class enrollments (comma-separated course codes)
          if (classesRaw) {
            const codes = classesRaw.split(",").map(c => c.trim()).filter(Boolean);
            if (codes.length > 0) {
              const courses = await db.select({ id: coursesTable.id, code: coursesTable.code })
                .from(coursesTable)
                .where(inArray(coursesTable.code, codes));
              const courseMap = new Map(courses.map(c => [c.code, c.id]));

              const studentRow = await db.select({ id: studentsTable.id })
                .from(studentsTable)
                .where(eq(studentsTable.personCode, personCode))
                .limit(1);

              if (studentRow[0]) {
                for (const code of codes) {
                  const courseId = courseMap.get(code);
                  if (courseId) {
                    await db.insert(enrollmentsTable)
                      .values({ studentId: studentRow[0].id, courseId })
                      .onConflictDoNothing();
                  }
                }
              }
            }
          }
        } catch (e: any) {
          errors.push(`Error for ${personCode}: ${e.message}`);
        }
      }
      summary["students"] = { inserted, updated, skipped: errors.length, errors };
    } else {
      summary["students"] = { inserted: 0, updated: 0, skipped: 0, errors: ["Sheet is empty or only has headers"] };
    }

    // ── 2. Attendance Log ─────────────────────────────────────────────────────
    const attendanceRows = await fetchSheet(connectors, ATTENDANCE_SHEET_ID, "Attendance Log");
    if (attendanceRows.length > 1) {
      // Row 0 header: Timestamp, Date, Student ID, Status, Notes, Marked By
      const dataRows = attendanceRows.slice(1).filter(r => r[2]?.trim() && r[1]?.trim());
      let inserted = 0, skipped = 0, errors: string[] = [];

      for (const row of dataRows) {
        const [_timestamp, dateRaw, personCode, status, notes, markedBy] = row.map(c => c?.trim() ?? "");
        if (!personCode || !dateRaw || !status) {
          skipped++;
          continue;
        }

        // Parse date - handle various formats
        let isoDate: string;
        try {
          const d = new Date(dateRaw);
          if (isNaN(d.getTime())) { skipped++; continue; }
          isoDate = d.toISOString().split("T")[0];
        } catch {
          skipped++;
          continue;
        }

        try {
          const student = await db.select({ id: studentsTable.id })
            .from(studentsTable)
            .where(eq(studentsTable.personCode, personCode))
            .limit(1);

          if (!student[0]) { skipped++; continue; }

          // Find the course for this attendance record — look up via enrollments
          const enrollments = await db.select({ courseId: enrollmentsTable.courseId })
            .from(enrollmentsTable)
            .where(eq(enrollmentsTable.studentId, student[0].id))
            .limit(1);

          if (!enrollments[0]) { skipped++; continue; }

          await db.insert(attendanceTable).values({
            studentId: student[0].id,
            courseId: enrollments[0].courseId,
            date: isoDate,
            status: status.toLowerCase(),
            notes: notes || null,
            markedBy: markedBy || null,
          }).onConflictDoNothing();
          inserted++;
        } catch (e: any) {
          errors.push(`Error for ${personCode} on ${dateRaw}: ${e.message}`);
        }
      }
      summary["attendance"] = { inserted, updated: 0, skipped, errors };
    } else {
      summary["attendance"] = { inserted: 0, updated: 0, skipped: 0, errors: ["Sheet is empty or only has headers"] };
    }

    // ── 3. KPI Benchmarks ─────────────────────────────────────────────────────
    const kpiRows = await fetchSheet(connectors, ATTENDANCE_SHEET_ID, "KPIs");
    if (kpiRows.length > 1) {
      // Find category headings + data rows
      let currentCategory = "";
      let kpiInserted = 0;
      const errors: string[] = [];

      // Clear existing benchmarks before re-syncing
      await db.delete(kpiBenchmarksTable);

      for (const row of kpiRows) {
        const [col0, col1, col2] = row.map(c => c?.trim() ?? "");
        if (!col0) continue;

        // Detect category heading rows (e.g. "Attendance Benchmarks", "Punctuality Benchmarks")
        if (col0.toLowerCase().includes("attendance")) {
          currentCategory = "attendance";
          continue;
        }
        if (col0.toLowerCase().includes("punctuality")) {
          currentCategory = "punctuality";
          continue;
        }
        // Skip the sub-header row "Description | Lower % | Higher %"
        if (col0.toLowerCase() === "description") continue;

        // Data row: label, lower %, upper %
        if (currentCategory && col1 && col2) {
          try {
            await db.insert(kpiBenchmarksTable).values({
              category: currentCategory,
              label: col0,
              lowerPercent: parsePercent(col1),
              upperPercent: parsePercent(col2),
            });
            kpiInserted++;
          } catch (e: any) {
            errors.push(`KPI row error: ${e.message}`);
          }
        }
      }
      summary["kpis"] = { inserted: kpiInserted, updated: 0, skipped: 0, errors };
    } else {
      summary["kpis"] = { inserted: 0, updated: 0, skipped: 0, errors: ["KPI sheet is empty"] };
    }

    return res.json({ ok: true, summary });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /admin/sync/status — returns counts of synced data + last KPI benchmarks
router.get("/admin/sync/status", async (req, res) => {
  if (!requireAdminOrHod(req, res)) return;

  const [studentCount, courseCount, attendanceCount, kpis] = await Promise.all([
    db.$count(studentsTable),
    db.$count(coursesTable),
    db.$count(attendanceTable),
    db.select().from(kpiBenchmarksTable).orderBy(kpiBenchmarksTable.category, kpiBenchmarksTable.lowerPercent),
  ]);

  return res.json({
    counts: { students: studentCount, courses: courseCount, attendance: attendanceCount },
    kpiBenchmarks: kpis,
  });
});

export default router;
