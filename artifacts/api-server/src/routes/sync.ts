import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db, studentsTable, coursesTable, attendanceTable, enrollmentsTable, kpiBenchmarksTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

const ATTENDANCE_SHEET_ID = "1eHSs1LPFM0cgMQQ4YWJQV2d20RSCm7-_xOCAWBfGLPQ";
const COURSES_SHEET_ID    = "1C_FLnvrEZGpjHKpJ1bHOqt1JeYw07BgtlIDLvQ1aa9M";

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

// Derive a short unique code from the sheet's numeric id: "C001", "C002", …
function courseCode(sheetId: string): string {
  const n = parseInt(sheetId, 10);
  return isNaN(n) ? sheetId.trim() : `C${String(n).padStart(3, "0")}`;
}

// POST /admin/sync/sheets
router.post("/admin/sync/sheets", async (req, res) => {
  if (!requireAdminOrHod(req, res)) return;

  try {
    const connectors = new ReplitConnectors();
    const summary: Record<string, { inserted: number; updated: number; skipped: number; errors: string[] }> = {};

    // ── 1. Courses (full replace) ─────────────────────────────────────────────
    const courseRows = await fetchSheet(connectors, COURSES_SHEET_ID, "Sheet1");
    if (courseRows.length > 1) {
      // header: id, code, name, room, staff_name, head_of_deprment, year_group, enrolled_count
      const dataRows = courseRows.slice(1).filter(r => r[0]?.trim() && r[2]?.trim());
      let inserted = 0, updated = 0, errors: string[] = [];

      for (const row of dataRows) {
        const [idRaw, _codeRaw, name, room, staffName, headOfDept, yearGroup, enrolledRaw] = row.map(c => c?.trim() ?? "");
        const code = courseCode(idRaw);
        const enrolledCount = parseInt(enrolledRaw, 10) || 0;

        try {
          const existing = await db.select({ id: coursesTable.id })
            .from(coursesTable)
            .where(eq(coursesTable.code, code))
            .limit(1);

          if (existing.length > 0) {
            await db.update(coursesTable).set({
              name,
              room: room || null,
              staffName: staffName || null,
              headOfDepartment: headOfDept || null,
              yearGroup: yearGroup || null,
              enrolledCount,
            }).where(eq(coursesTable.code, code));
            updated++;
          } else {
            await db.insert(coursesTable).values({
              code,
              name,
              room: room || null,
              staffName: staffName || null,
              headOfDepartment: headOfDept || null,
              yearGroup: yearGroup || null,
              enrolledCount,
            });
            inserted++;
          }
        } catch (e: any) {
          errors.push(`Error for course ${code}: ${e.message}`);
        }
      }
      summary["courses"] = { inserted, updated, skipped: 0, errors };
    } else {
      summary["courses"] = { inserted: 0, updated: 0, skipped: 0, errors: ["Courses sheet is empty"] };
    }

    // ── 2. Students Roster ────────────────────────────────────────────────────
    const studentRows = await fetchSheet(connectors, ATTENDANCE_SHEET_ID, "Students Roster");
    if (studentRows.length > 1) {
      // header: Student ID, First Name, Last Name, Year Group, Form Group, Classes
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
              personCode, forename, surname,
              yearGroup: yearGroup || null,
              formGroup: formGroup || null,
            });
            inserted++;
          }

          // Enroll into courses (comma-separated course codes OR C-prefixed ids)
          if (classesRaw) {
            const rawCodes = classesRaw.split(",").map(c => c.trim()).filter(Boolean);
            if (rawCodes.length > 0) {
              const courses = await db.select({ id: coursesTable.id, code: coursesTable.code })
                .from(coursesTable)
                .where(inArray(coursesTable.code, rawCodes));
              const courseMap = new Map(courses.map(c => [c.code, c.id]));

              const studentRow = await db.select({ id: studentsTable.id })
                .from(studentsTable)
                .where(eq(studentsTable.personCode, personCode))
                .limit(1);

              if (studentRow[0]) {
                for (const code of rawCodes) {
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
      summary["students"] = { inserted: 0, updated: 0, skipped: 0, errors: ["Students sheet is empty or only has headers"] };
    }

    // ── 3. Attendance Log ─────────────────────────────────────────────────────
    const attendanceRows = await fetchSheet(connectors, ATTENDANCE_SHEET_ID, "Attendance Log");
    if (attendanceRows.length > 1) {
      // header: Timestamp, Date, Student ID, Status, Notes, Marked By
      const dataRows = attendanceRows.slice(1).filter(r => r[2]?.trim() && r[1]?.trim());
      let inserted = 0, skipped = 0, errors: string[] = [];

      for (const row of dataRows) {
        const [_timestamp, dateRaw, personCode, status, notes, markedBy] = row.map(c => c?.trim() ?? "");
        if (!personCode || !dateRaw || !status) { skipped++; continue; }

        let isoDate: string;
        try {
          const d = new Date(dateRaw);
          if (isNaN(d.getTime())) { skipped++; continue; }
          isoDate = d.toISOString().split("T")[0];
        } catch { skipped++; continue; }

        try {
          const student = await db.select({ id: studentsTable.id })
            .from(studentsTable)
            .where(eq(studentsTable.personCode, personCode))
            .limit(1);
          if (!student[0]) { skipped++; continue; }

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
      summary["attendance"] = { inserted: 0, updated: 0, skipped: 0, errors: ["Attendance sheet is empty or only has headers"] };
    }

    // ── 4. KPI Benchmarks ─────────────────────────────────────────────────────
    const kpiRows = await fetchSheet(connectors, ATTENDANCE_SHEET_ID, "KPIs");
    if (kpiRows.length > 1) {
      let currentCategory = "";
      let kpiInserted = 0;
      const errors: string[] = [];
      await db.delete(kpiBenchmarksTable);

      for (const row of kpiRows) {
        const [col0, col1, col2] = row.map(c => c?.trim() ?? "");
        if (!col0) continue;
        if (col0.toLowerCase().includes("attendance")) { currentCategory = "attendance"; continue; }
        if (col0.toLowerCase().includes("punctuality")) { currentCategory = "punctuality"; continue; }
        if (col0.toLowerCase() === "description") continue;
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

// GET /admin/sync/status
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
