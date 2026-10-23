import { parseSessionSheet, type SessionCourse, type SessionSlot } from "./session-sync";
import type { SyncSummaryEntry } from "./sheet-sync";

export async function refreshSessionSheet(
  load: () => Promise<string[][]>,
  loadCourses: () => Promise<SessionCourse[]>,
  persist: (slots: SessionSlot[]) => Promise<Pick<SyncSummaryEntry, "inserted" | "updated" | "unchanged" | "retired">>,
): Promise<SyncSummaryEntry> {
  const entry: SyncSummaryEntry = { inserted: 0, updated: 0, unchanged: 0,
    skipped: 0, retired: 0, invalid: 0, duplicates: 0, unmatched: 0, errors: [] };
  try {
    const rows = await load();
    const parsed = parseSessionSheet(rows, await loadCourses());
    Object.assign(entry, { skipped: parsed.skipped, invalid: parsed.errors.length,
      duplicates: parsed.duplicates, unmatched: parsed.unmatched, errors: parsed.errors });
    if (!parsed.errors.length) Object.assign(entry, await persist(parsed.slots));
  } catch (error) {
    entry.errors = [error instanceof Error ? error.message : String(error)];
    entry.invalid = 1;
  }
  return entry;
}