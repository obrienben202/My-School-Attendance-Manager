import type { PersonalSlot } from "./my-timetable-query.ts";

export const timetableDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export const timetablePeriods = [
  { label: "Form Time / Registration", start: "08:45", end: "09:00", band: true },
  { label: "Lesson 1", start: "09:00", end: "09:55", band: false },
  { label: "Lesson 2", start: "09:55", end: "10:45", band: false },
  { label: "Break", start: "10:45", end: "11:05", band: true },
  { label: "Lesson 3", start: "11:05", end: "11:55", band: false },
  { label: "Lesson 4", start: "11:55", end: "12:45", band: false },
  { label: "Lunch", start: "12:45", end: "13:25", band: true },
  { label: "Lesson 5", start: "13:25", end: "14:25", band: false },
  { label: "Lesson 6", start: "14:25", end: "15:30", band: false },
] as const;

function minutes(time: string | null): number | null {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export const sessionTime = (slot: PersonalSlot) =>
  `${slot.startTime?.trim() || "Time not recorded"}–${slot.endTime?.trim() || "Time not recorded"}`;
export const sessionDetails = (slot: PersonalSlot) =>
  [slot.groupLabel, slot.room, slot.weekPattern].filter(Boolean).join(" · ");

export interface TimetableEntry {
  slot: PersonalSlot;
  /** Source index preserves distinct records even when their identifiers coincide. */
  sourceIndex: number;
  crossPeriod: boolean;
}
export interface AdditionalEntry {
  slot: PersonalSlot;
  sourceIndex: number;
  reason: string;
}

export function buildWeeklyTimetable(slots: readonly PersonalSlot[]) {
  const rows = timetablePeriods.map(period => ({
    ...period,
    cells: timetableDays.map(() => [] as TimetableEntry[]),
  }));
  const additional: AdditionalEntry[] = [];
  slots.forEach((slot, sourceIndex) => {
    const dayIndex = timetableDays.findIndex(day => day === slot.day);
    const start = minutes(slot.startTime);
    const end = minutes(slot.endTime);
    let reason = "";
    if (dayIndex < 0) reason = "Weekday not recognised";
    else if (start === null || end === null) reason = "Missing or invalid times";
    else if (end <= start) reason = "End time is not after start time";
    else if (start < minutes("09:00")! || end > minutes("15:30")!) reason = "Outside lesson hours";
    else if (timetablePeriods.some(period => period.band && start < minutes(period.end)! && end > minutes(period.start)!)) {
      reason = "Overlaps registration, break or lunch";
    }
    if (reason) {
      additional.push({ slot, sourceIndex, reason });
      return;
    }
    const affected = rows.filter(row => !row.band && start! < minutes(row.end)! && end! > minutes(row.start)!);
    if (!affected.length) {
      additional.push({ slot, sourceIndex, reason: "Outside lesson periods" });
      return;
    }
    for (const row of affected) row.cells[dayIndex].push({ slot, sourceIndex, crossPeriod: affected.length > 1 });
  });
  // Stable chronological ordering; source index breaks ties without merging overlaps.
  for (const row of rows) for (const cell of row.cells) {
    cell.sort((a, b) => minutes(a.slot.startTime)! - minutes(b.slot.startTime)! || a.sourceIndex - b.sourceIndex);
  }
  return { rows, additional };
}