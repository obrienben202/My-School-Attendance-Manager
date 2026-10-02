import { eq, inArray, sql } from "drizzle-orm";
import { db, scheduleTable } from "@workspace/db";
import { SESSION_SHEET_SOURCE } from "./session-sync";
import { findStaleImportedSlotIds, TECHNOLOGY_TIMETABLE_SOURCE, type ImportedTimetableSlot } from "./timetable-sync";

export async function persistMaintainedTimetable(
  slots: ImportedTimetableSlot[], database: Pick<typeof db, "transaction"> = db,
) {
  return database.transaction(async tx => {
    // Same lock as Sessions: even a legacy run planned before takeover cannot
    // restore its old lessons after a newer snapshot commits.
    await tx.execute(sql`select pg_advisory_xact_lock(1042026)`);
    const owned = await tx.select({ courseId: scheduleTable.courseId }).from(scheduleTable)
      .where(eq(scheduleTable.source, SESSION_SHEET_SOURCE));
    const ownedIds = new Set(owned.map(s => s.courseId));
    const desired = slots.filter(s => !ownedIds.has(s.courseId));
    const existing = (await tx.select().from(scheduleTable)
      .where(eq(scheduleTable.source, TECHNOLOGY_TIMETABLE_SOURCE)))
      .filter(s => s.isActive && !ownedIds.has(s.courseId));
    const byKey = new Map(existing.map(s => [s.sourceKey, s]));
    let inserted = 0, updated = 0;
    for (const slot of desired) {
      const old = byKey.get(slot.sourceKey);
      if (old) {
        await tx.update(scheduleTable).set(slot).where(eq(scheduleTable.id, old.id));
        updated++;
      } else {
        await tx.insert(scheduleTable).values(slot);
        inserted++;
      }
    }
    const retireIds = findStaleImportedSlotIds(existing, desired.map(s => s.sourceKey));
    if (retireIds.length) await tx.update(scheduleTable).set({ isActive: false })
      .where(inArray(scheduleTable.id, retireIds));
    return { inserted, updated, retired: retireIds.length };
  });
}