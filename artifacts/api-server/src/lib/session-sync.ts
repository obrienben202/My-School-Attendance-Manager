import { normalizeTeachingDay } from "./schedule-day";
import { TECHNOLOGY_TIMETABLE_SOURCE } from "./timetable-sync";

export const SESSION_SHEET_SOURCE = "courses-sessions-sheet";
// Verified against the existing Courses spreadsheet's tab metadata.
export const SESSION_SHEET_TAB = "Sessions sheet";
export type SessionCourse = {
  id: number; sourceId: string | null; code: string; room: string | null; staffName: string | null;
};
export type SessionSlot = {
  courseId: number; day: string; startTime: string; endTime: string;
  weekPattern: string; staffName: string | null; room: string | null;
  source: string; sourceKey: string; isActive: boolean;
};
export type ExistingSession = Omit<SessionSlot, "day" | "source" | "sourceKey"> & {
  id: number; day: string | null; source: string | null; sourceKey: string | null;
};

export function parseSessionSheet(rows: string[][], courses: SessionCourse[]) {
  const slots: SessionSlot[] = [];
  const errors: string[] = [];
  let skipped = 0, duplicates = 0, unmatched = 0;
  const headers = ["id", "code", "day", "start time", "end time", "week pattern"];
  if (!headers.every((header, i) => rows[0]?.[i]?.trim().toLowerCase() === header)) {
    return { slots, errors: ["Sessions row 1: expected headers id, code, Day, Start Time, End Time, Week Pattern in columns A–F"], skipped, duplicates, unmatched };
  }
  const seen = new Set<string>();
  rows.slice(1).forEach((row, i) => {
    if (row.every(value => !String(value ?? "").trim())) { skipped++; return; }
    const [id, code, rawDay, startTime, endTime, rawPattern] =
      Array.from({ length: 6 }, (_, j) => String(row[j] ?? "").trim());
    const prefix = `Sessions row ${i + 2} (${code || id || "missing course"}): `;
    const course = courses.find(c => c.sourceId === id);
    if (!id || !code || !course || course.code !== code) {
      unmatched++;
      errors.push(prefix + "id must match an active course's Sheet1 source id and code must agree");
      return;
    }
    const day = normalizeTeachingDay(rawDay);
    if (!day) { errors.push(prefix + "Day must be Monday, Tuesday, Wednesday, Thursday or Friday"); return; }
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(startTime) || !time.test(endTime) || startTime >= endTime) {
      errors.push(prefix + "use 24-hour HH:mm times with End Time after Start Time"); return;
    }
    const weekPattern = ({ "every week": "Every week", "week a": "Week A", "week b": "Week B" } as Record<string, string>)[rawPattern.toLowerCase()];
    if (!weekPattern) { errors.push(prefix + "Week Pattern must be Every Week, Week A or Week B"); return; }
    const sourceKey = JSON.stringify([course.id, day, startTime, endTime, weekPattern]);
    if (seen.has(sourceKey)) { duplicates++; errors.push(prefix + "duplicate session (same course, day, times and week pattern)"); return; }
    seen.add(sourceKey);
    slots.push({ courseId: course.id, day, startTime, endTime, weekPattern,
      staffName: course.staffName, room: course.room, source: SESSION_SHEET_SOURCE, sourceKey, isActive: true });
  });
  if (!slots.length && !errors.length) errors.push("Sessions contains no teaching rows; existing schedules were left unchanged");
  return { slots, errors, skipped, duplicates, unmatched };
}

/**
 * Content identity is independent of sheet row order. First preserve exact
 * matches, then mutually unique same-day/pattern edits, then a sole remaining
 * pair. Ambiguous edits retire old identities instead of guessing register links.
 * Retired rows are never repurposed for a different session.
 */
export function reconcileSessions(slots: SessionSlot[], existing: ExistingSession[]) {
  const updates: { id: number; slot: SessionSlot }[] = [];
  const inserts: SessionSlot[] = [];
  const represented = new Set(slots.map(s => s.courseId));
  const candidates = existing.filter(s => s.isActive && represented.has(s.courseId) &&
    (s.source === SESSION_SHEET_SOURCE || s.source === TECHNOLOGY_TIMETABLE_SOURCE));
  const remaining = new Map(candidates.map(s => [s.id, s]));
  const desired = [...slots].sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  const pending: SessionSlot[] = [];
  const sameContent = (a: SessionSlot, b: ExistingSession) =>
    a.courseId === b.courseId && a.day === b.day && a.startTime === b.startTime &&
    a.endTime === b.endTime && a.weekPattern === b.weekPattern;
  const use = (slot: SessionSlot, old: ExistingSession) => {
    updates.push({ id: old.id, slot }); remaining.delete(old.id);
  };
  for (const slot of desired) {
    const exact = [...remaining.values()].filter(old => sameContent(slot, old)).sort((a, b) =>
      Number(b.source === SESSION_SHEET_SOURCE) - Number(a.source === SESSION_SHEET_SOURCE) || a.id - b.id);
    if (exact.length) use(slot, exact[0]); else pending.push(slot);
  }
  for (const courseId of represented) {
    let todo = pending.filter(s => s.courseId === courseId);
    for (const slot of [...todo]) {
      const matches = [...remaining.values()].filter(old =>
        old.courseId === courseId && old.day === slot.day && old.weekPattern === slot.weekPattern);
      if (matches.length === 1 && todo.filter(s => s.day === slot.day && s.weekPattern === slot.weekPattern).length === 1) {
        use(slot, matches[0]); todo = todo.filter(s => s !== slot);
      }
    }
    const old = [...remaining.values()].filter(s => s.courseId === courseId);
    if (todo.length === 1 && old.length === 1) { use(todo[0], old[0]); todo = []; }
    inserts.push(...todo);
  }
  return { updates, inserts, retireIds: [...remaining.keys()] };
}