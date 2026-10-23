import { and, eq, inArray, sql } from "drizzle-orm";
import { db, scheduleTable } from "@workspace/db";
import { reconcileSessions, type SessionSlot } from "./session-sync";

// Accept the same Drizzle transaction interface for isolated database fixtures.
export async function persistSessionSnapshot(
  slots: SessionSlot[], database: Pick<typeof db, "transaction"> = db,
) {
  if (!slots.length) throw new Error("Refusing an empty session snapshot");
  return database.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(1042026)`);
    const existing = await tx.select().from(scheduleTable)
      .where(inArray(scheduleTable.courseId, [...new Set(slots.map(s => s.courseId))]));
    const plan = reconcileSessions(slots, existing);
    let unchanged = 0;
    for (const { id, slot } of plan.updates) {
      const old = existing.find(s => s.id === id)!;
      if (Object.entries(slot).every(([key, value]) => old[key as keyof typeof old] === value)) { unchanged++; continue; }
      await tx.update(scheduleTable).set(slot).where(eq(scheduleTable.id, id));
    }
    if (plan.inserts.length) await tx.insert(scheduleTable).values(plan.inserts);
    if (plan.retireIds.length) await tx.update(scheduleTable).set({ isActive: false })
      .where(and(inArray(scheduleTable.id, plan.retireIds), eq(scheduleTable.isActive, true)));
    return { inserted: plan.inserts.length, updated: plan.updates.length - unchanged,
      unchanged, retired: plan.retireIds.length };
  });
}