/**
 * sheet-sync.ts
 * Core logic for syncing Google Sheets → DB.
 * Called by the background scheduler AND the manual-trigger endpoint.
 * Students are NOT enrolled in courses here — enrolment is managed separately per year group.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  assessmentsTable,
  attendanceTable,
  conciergeApplicationsTable,
  coursesTable,
  db,
  enrollmentsTable,
  eprogressionsTable,
  kpiBenchmarksTable,
  scheduleTable,
  studentsTable,
} from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  chooseCourseReconciliation,
  findStaleCourseIds,
  parseCourseSheetRows,
} from "./course-sync";
import {
  findStaleImportedSlotIds,
  resolveMaintainedTimetable,
  TECHNOLOGY_STAFF_TIMETABLE,
  TECHNOLOGY_TIMETABLE_SOURCE,
} from "./timetable-sync";

const ATTENDANCE_SHEET_ID = "1eHSs1LPFM0cgMQQ4YWJQV2d20RSCm7-_xOCAWBfGLPQ";
const COURSES_SHEET_ID    = "1C_FLnvrEZGpjHKpJ1bHOqt1JeYw07BgtlIDLvQ1aa9M";

export type SyncSummaryEntry = {
  inserted: number;
  updated:  number;
  skipped:  number;
  retired:  number;
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

async function mergeCourseRelationships(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  fromCourseId: number,
  toCourseId: number,
) {
  await tx.execute(sql`
    insert into student_enrollments (student_id, course_id, created_at)
    select student_id, ${toCourseId}, created_at
    from student_enrollments
    where course_id = ${fromCourseId}
    on conflict (student_id, course_id) do nothing
  `);
  await tx.delete(enrollmentsTable).where(eq(enrollmentsTable.courseId, fromCourseId));
  await Promise.all([
    tx.update(attendanceTable).set({ courseId: toCourseId }).where(eq(attendanceTable.courseId, fromCourseId)),
    tx.update(scheduleTable).set({ courseId: toCourseId }).where(eq(scheduleTable.courseId, fromCourseId)),
    tx.update(assessmentsTable).set({ courseId: toCourseId }).where(eq(assessmentsTable.courseId, fromCourseId)),
    tx.update(eprogressionsTable).set({ courseId: toCourseId }).where(eq(eprogressionsTable.courseId, fromCourseId)),
    tx.update(conciergeApplicationsTable).set({ courseId: toCourseId }).where(eq(conciergeApplicationsTable.courseId, fromCourseId)),
  ]);
  await tx.delete(coursesTable).where(eq(coursesTable.id, fromCourseId));
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

    // 1. Courses — authoritative source, preserving legacy IDs and soft-retiring stale rows.
    {
      const rows = await fetchSheet(connectors, COURSES_SHEET_ID, "Sheet1");
      const parsed = parseCourseSheetRows(rows);
      if (parsed.errors.length > 0) {
        throw new Error(`Course sheet validation failed: ${parsed.errors.join("; ")}`);
      }
      if (parsed.records.length === 0) {
        throw new Error("Course sheet contained no valid course records; existing courses were left unchanged");
      }

      let inserted = 0, updated = 0;
      let retired = 0;
      const errors: string[] = [];

      await db.transaction(async tx => {
        let existing = await tx.select({
          id: coursesTable.id,
          code: coursesTable.code,
          sourceId: coursesTable.sourceId,
          isActive: coursesTable.isActive,
        }).from(coursesTable);
        const activeIds: number[] = [];

        for (const record of parsed.records) {
          const reconciliation = chooseCourseReconciliation(record, existing);
          let targetId = reconciliation.targetId;

          if (targetId === null) {
            const [created] = await tx.insert(coursesTable).values({
              ...record,
              level: null,
              faculty: null,
              academicYear: null,
              courseHours: null,
              status: null,
              isActive: true,
            }).returning({ id: coursesTable.id });
            targetId = created.id;
            inserted++;
          } else {
            for (const duplicateId of reconciliation.duplicateIds) {
              await mergeCourseRelationships(tx, duplicateId, targetId);
              existing = existing.filter(course => course.id !== duplicateId);
            }
            await tx.update(coursesTable).set({
              ...record,
              level: null,
              faculty: null,
              academicYear: null,
              courseHours: null,
              status: null,
              isActive: true,
            }).where(eq(coursesTable.id, targetId));
            updated++;
          }

          activeIds.push(targetId);
          existing = existing.filter(course => course.id !== targetId);
          existing.push({ id: targetId, code: record.code, sourceId: record.sourceId, isActive: true });
        }

        const activeExistingIds = existing.filter(course => course.isActive).map(course => course.id);
        const staleIds = findStaleCourseIds(activeExistingIds, activeIds);
        if (staleIds.length > 0) {
          await tx.update(coursesTable).set({ isActive: false }).where(inArray(coursesTable.id, staleIds));
          retired = staleIds.length;
        }
      });

      summary["courses"] = { inserted, updated, skipped: parsed.skipped, retired, errors };
    }

    // 2. Maintained Technology staff timetable — reconcile source-owned course slots.
    {
      const courses = await db.select({
        id: coursesTable.id,
        sourceId: coursesTable.sourceId,
        code: coursesTable.code,
        room: coursesTable.room,
      }).from(coursesTable).where(eq(coursesTable.isActive, true));
      const resolved = resolveMaintainedTimetable(TECHNOLOGY_STAFF_TIMETABLE, courses);
      if (resolved.slots.length === 0) {
        throw new Error("Maintained timetable matched no active courses; existing imported slots were left unchanged");
      }

      let inserted = 0;
      let updated = 0;
      let retired = 0;

      await db.transaction(async tx => {
        const existing = await tx.select({
          id: scheduleTable.id,
          source: scheduleTable.source,
          sourceKey: scheduleTable.sourceKey,
        }).from(scheduleTable).where(eq(scheduleTable.source, TECHNOLOGY_TIMETABLE_SOURCE));
        const existingByKey = new Map(
          existing
            .filter(slot => slot.sourceKey !== null)
            .map(slot => [slot.sourceKey as string, slot]),
        );

        for (const slot of resolved.slots) {
          const current = existingByKey.get(slot.sourceKey);
          if (current) {
            await tx.update(scheduleTable).set(slot).where(eq(scheduleTable.id, current.id));
            updated++;
          } else {
            await tx.insert(scheduleTable).values(slot);
            inserted++;
          }
        }

        const staleIds = findStaleImportedSlotIds(
          existing,
          resolved.slots.map(slot => slot.sourceKey),
        );
        if (staleIds.length > 0) {
          await tx.delete(scheduleTable).where(inArray(scheduleTable.id, staleIds));
          retired = staleIds.length;
        }
      });

      summary["timetable"] = {
        inserted,
        updated,
        skipped: resolved.skipped,
        retired,
        errors: resolved.errors,
      };
    }

    // 3. Students Roster — upsert by Student ID; NO course enrolments (handled separately)
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
      summary["students"] = { inserted, updated, skipped: errors.length, retired: 0, errors };
    }

    // 4. Attendance Log — insert new records only (skip if student/course not yet linked)
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
      summary["attendance"] = { inserted, updated: 0, skipped, retired: 0, errors };
    }

    // 5. KPI Benchmarks — full replace
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
      summary["kpis"] = { inserted, updated: 0, skipped: 0, retired: 0, errors };
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
