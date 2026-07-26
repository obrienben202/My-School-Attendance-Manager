/**
 * sheet-sync.ts
 * Core logic for syncing Google Sheets → DB.
 * Called by the background scheduler AND the manual-trigger endpoint.
 * Students are NOT enrolled in courses here — enrolment is managed separately per year group.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db, studentsTable, coursesTable, attendanceTable, kpiBenchmarksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const ATTENDANCE_SHEET_ID = "1eHSs1LPFM0cgMQQ4YWJQV2d20RSCm7-_xOCAWBfGLPQ";
const COURSES_SHEET_ID    = "1C_FLnvrEZGpjHKpJ1bHOqt1JeYw07BgtlIDLvQ1aa9M";

export type SyncSummaryEntry = {
  inserted: number;
  updated:  number;
  skipped:  number;
  errors:   string[];
};

export type SyncSummary = Record<string, SyncSummaryEntry>;

type SyncState = {
  lastRanAt:  Date | null;
  lastSummary: SyncSummary | null;
  lastError:   string | null;
  running:     boolean;
};

const state: SyncState = {
  lastRanAt:   null,
  lastSummary: null,
  lastError:   null,
  running:     false,
};

export function getSyncState() {
  return { ...state };
}

// ── helpers ────────────────────────────────────────────────────────────────────

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

function courseCode(sheetId: string): string {
  const n = parseInt(sheetId, 10);
  return isNaN(n) ? sheetId.trim() : `C${String(n).padStart(3, "0")}`;
}

/** Normalise known name variants that the spreadsheet stores without apostrophes. */
function normaliseName(name: string): string {
  return name
    .replace(/\bO'?Brien\b/gi, "O'Brien")   // OBrien → O'Brien
    .replace(/\bO'?Connor\b/gi, "O'Connor") // future-proof similar cases
    .trim();
}

/** Derive a study level from the course name and year group. */
function deriveLevel(name: string, yearGroup: string): string {
  const n = name.toUpperCase();
  if (n.includes("GCSE") && !n.includes("NON GCSE")) return "GCSE";
  if (n.includes("A LEVEL") || n.includes("A-LEVEL"))  return "A Level";
  if (n.includes("BTEC"))                               return "BTEC";
  if (n.includes("NON GCSE"))                           return "Level 2";
  if (n.includes("DIGITAL TECHNOLOGY") || n.includes("COMPUTER SCIENCE")) return "Level 3";
  if (["Year 7", "Year 8", "Year 9"].includes(yearGroup))   return "Level 2";
  if (["Year 10", "Year 11"].includes(yearGroup))            return "Level 3";
  return "Level 2";
}

/** Derive a faculty/department from the course name. */
function deriveFaculty(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("ICT") || n.includes("DIGITAL") || n.includes("COMPUTER") ||
      (n.includes(" IT ") || n.includes(" IT-") || n.endsWith(" IT"))) return "IT";
  if (n.includes("MATHS") || n.includes("MATHEMATICS")) return "Mathematics";
  if (n.includes("ENGLISH"))                            return "English";
  if (n.includes("HISTORY"))                            return "History";
  if (n.includes("SCIENCE"))                            return "Science";
  if (n.includes("DRAMA"))                              return "Arts & Drama";
  if (n.includes("MUSIC"))                              return "Music";
  if (n.includes("PE") || n.includes("SPORT"))         return "PE & Sport";
  if (n.includes("FRENCH") || n.includes("WELSH") || n.includes("SPANISH")) return "Modern Languages";
  return "General Studies";
}

// ── main sync ──────────────────────────────────────────────────────────────────

export async function runSync(): Promise<SyncSummary> {
  if (state.running) {
    logger.info("Sync already in progress — skipping");
    return state.lastSummary ?? {};
  }

  state.running = true;
  const summary: SyncSummary = {};

  try {
    const connectors = new ReplitConnectors();

    // 1. Courses — upsert by generated code, never delete (so attendance FKs stay intact)
    {
      const rows = await fetchSheet(connectors, COURSES_SHEET_ID, "Sheet1");
      const dataRows = rows.slice(1).filter(r => r[0]?.trim() && r[2]?.trim());
      let inserted = 0, updated = 0;
      const errors: string[] = [];

      for (const row of dataRows) {
        const [idRaw, , name, room, rawStaff, rawHead, yearGroup, enrolledRaw] = row.map(c => c?.trim() ?? "");
        const staffName  = rawStaff ? normaliseName(rawStaff) : "";
        const headOfDept = rawHead  ? normaliseName(rawHead)  : "";
        const code = courseCode(idRaw);
        const enrolledCount = parseInt(enrolledRaw, 10) || 0;
        try {
          const existing = await db.select({ id: coursesTable.id })
            .from(coursesTable).where(eq(coursesTable.code, code)).limit(1);
          const level   = deriveLevel(name, yearGroup);
          const faculty = deriveFaculty(name);
          if (existing.length > 0) {
            await db.update(coursesTable).set({
              name, room: room || null, staffName: staffName || null,
              headOfDepartment: headOfDept || null, yearGroup: yearGroup || null, enrolledCount,
              level, faculty,
            }).where(eq(coursesTable.code, code));
            updated++;
          } else {
            await db.insert(coursesTable).values({
              code, name, room: room || null, staffName: staffName || null,
              headOfDepartment: headOfDept || null, yearGroup: yearGroup || null, enrolledCount,
              level, faculty,
            });
            inserted++;
          }
        } catch (e: any) {
          errors.push(`${code}: ${e.message}`);
        }
      }
      summary["courses"] = { inserted, updated, skipped: 0, errors };
    }

    // 2. Students Roster — upsert by Student ID; NO course enrolments (handled separately)
    {
      const rows = await fetchSheet(connectors, ATTENDANCE_SHEET_ID, "Students Roster");
      const dataRows = rows.slice(1).filter(r => r[0]?.trim());
      let inserted = 0, updated = 0;
      const errors: string[] = [];

      for (const row of dataRows) {
        const [personCode, forename, surname, yearGroup, formGroup] = row.map(c => c?.trim() ?? "");
        if (!personCode || !forename || !surname) { errors.push(`Incomplete: ${JSON.stringify(row)}`); continue; }
        try {
          const existing = await db.select({ id: studentsTable.id })
            .from(studentsTable).where(eq(studentsTable.personCode, personCode)).limit(1);
          if (existing.length > 0) {
            await db.update(studentsTable)
              .set({ forename, surname, yearGroup: yearGroup || null, formGroup: formGroup || null })
              .where(eq(studentsTable.personCode, personCode));
            updated++;
          } else {
            await db.insert(studentsTable).values({
              personCode, forename, surname,
              yearGroup: yearGroup || null, formGroup: formGroup || null,
            });
            inserted++;
          }
        } catch (e: any) {
          errors.push(`${personCode}: ${e.message}`);
        }
      }
      summary["students"] = { inserted, updated, skipped: errors.length, errors };
    }

    // 3. Attendance Log — insert new records only (skip if student/course not yet linked)
    {
      const rows = await fetchSheet(connectors, ATTENDANCE_SHEET_ID, "Attendance Log");
      const dataRows = rows.slice(1).filter(r => r[2]?.trim() && r[1]?.trim());
      let inserted = 0, skipped = 0;
      const errors: string[] = [];

      for (const row of dataRows) {
        const [, dateRaw, personCode, status, notes, markedBy] = row.map(c => c?.trim() ?? "");
        if (!personCode || !dateRaw || !status) { skipped++; continue; }

        let isoDate: string;
        try {
          const d = new Date(dateRaw);
          if (isNaN(d.getTime())) { skipped++; continue; }
          isoDate = d.toISOString().split("T")[0];
        } catch { skipped++; continue; }

        try {
          const student = await db.select({ id: studentsTable.id })
            .from(studentsTable).where(eq(studentsTable.personCode, personCode)).limit(1);
          if (!student[0]) { skipped++; continue; }

          // Find any enrolled course for this student to satisfy the FK
          const { enrollmentsTable } = await import("@workspace/db");
          const enrolled = await db.select({ courseId: enrollmentsTable.courseId })
            .from(enrollmentsTable).where(eq(enrollmentsTable.studentId, student[0].id)).limit(1);
          if (!enrolled[0]) { skipped++; continue; }

          await db.insert(attendanceTable).values({
            studentId: student[0].id,
            courseId: enrolled[0].courseId,
            date: isoDate,
            status: status.toLowerCase(),
            notes: notes || null,
            markedBy: markedBy || null,
          }).onConflictDoNothing();
          inserted++;
        } catch (e: any) {
          errors.push(`${personCode}@${dateRaw}: ${e.message}`);
        }
      }
      summary["attendance"] = { inserted, updated: 0, skipped, errors };
    }

    // 4. KPI Benchmarks — full replace
    {
      const rows = await fetchSheet(connectors, ATTENDANCE_SHEET_ID, "KPIs");
      let currentCategory = "";
      let inserted = 0;
      const errors: string[] = [];
      await db.delete(kpiBenchmarksTable);

      for (const row of rows) {
        const [col0, col1, col2] = row.map(c => c?.trim() ?? "");
        if (!col0) continue;
        if (col0.toLowerCase().includes("attendance"))  { currentCategory = "attendance";  continue; }
        if (col0.toLowerCase().includes("punctuality")) { currentCategory = "punctuality"; continue; }
        if (col0.toLowerCase() === "description") continue;
        if (currentCategory && col1 && col2) {
          try {
            await db.insert(kpiBenchmarksTable).values({
              category: currentCategory, label: col0,
              lowerPercent: parsePercent(col1), upperPercent: parsePercent(col2),
            });
            inserted++;
          } catch (e: any) {
            errors.push(e.message);
          }
        }
      }
      summary["kpis"] = { inserted, updated: 0, skipped: 0, errors };
    }

    state.lastSummary = summary;
    state.lastError   = null;
    state.lastRanAt   = new Date();
    logger.info({ summary }, "Sheet sync completed");
  } catch (err: any) {
    state.lastError = err.message;
    logger.error({ err }, "Sheet sync failed");
    throw err;
  } finally {
    state.running = false;
  }

  return summary;
}

// ── background scheduler ───────────────────────────────────────────────────────
// Runs every 15 minutes; fires once immediately on startup after a short delay.

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startSyncScheduler() {
  // First run after 30 seconds (let the server settle)
  setTimeout(() => {
    runSync().catch(() => {/* already logged */});
    setInterval(() => {
      runSync().catch(() => {/* already logged */});
    }, INTERVAL_MS);
  }, 30_000);

  logger.info("Sheet sync scheduler started — runs every 15 minutes");
}
