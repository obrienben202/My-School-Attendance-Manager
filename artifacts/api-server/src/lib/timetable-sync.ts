import { legacyCourseCode } from "./course-sync";

export const TECHNOLOGY_TIMETABLE_SOURCE = "technology-staff-timetable-2025-2026";

export type MaintainedTimetableRow = {
  slotKey: string;
  staffName: string;
  day: string;
  startLesson: number;
  endLesson: number;
  description: string;
  courseSourceId: string | null;
};

export type TimetableCourseIdentity = {
  id: number;
  sourceId: string | null;
  code: string;
  room: string | null;
};

export type ImportedTimetableSlot = {
  courseId: number;
  day: string;
  startTime: string;
  endTime: string;
  room: string | null;
  staffName: string;
  weekPattern: string;
  source: string;
  sourceKey: string;
};

export type ExistingImportedSlot = {
  id: number;
  source: string | null;
  sourceKey: string | null;
};

const LESSON_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "08:30", end: "09:30" },
  2: { start: "09:30", end: "10:30" },
  3: { start: "10:50", end: "11:50" },
  4: { start: "11:50", end: "12:50" },
  5: { start: "13:30", end: "14:30" },
  6: { start: "14:30", end: "15:30" },
};

/**
 * Teaching blocks transcribed from the maintained Technology staff timetable.
 * Non-course duties are represented with a null courseSourceId so they never
 * create course schedule rows. Source ids point at the authoritative course
 * sheet identities rather than creating or matching courses by display name.
 */
export const TECHNOLOGY_STAFF_TIMETABLE: MaintainedTimetableRow[] = [
  { slotKey: "mon-matthew-1", staffName: "Mr Matthew Shaper", day: "Monday", startLesson: 1, endLesson: 2, description: "Y10 GCSE Digital Tech G1", courseSourceId: "8" },
  { slotKey: "mon-ben-3", staffName: "Mr Ben O'Brien", day: "Monday", startLesson: 3, endLesson: 4, description: "Y11 GCSE Digital Tech G1", courseSourceId: "10" },
  { slotKey: "mon-ben-5", staffName: "Mr Ben O'Brien", day: "Monday", startLesson: 5, endLesson: 5, description: "Y7 IT G1", courseSourceId: "1" },
  { slotKey: "mon-matthew-5", staffName: "Mr Matthew Shaper", day: "Monday", startLesson: 5, endLesson: 5, description: "Y7 IT G2", courseSourceId: "2" },
  { slotKey: "mon-ben-6", staffName: "Mr Ben O'Brien", day: "Monday", startLesson: 6, endLesson: 6, description: "Y8 Foundation Maths G1", courseSourceId: "46" },
  { slotKey: "mon-matthew-6", staffName: "Mr Matthew Shaper", day: "Monday", startLesson: 6, endLesson: 6, description: "Y10 Foundation Maths", courseSourceId: "54" },

  { slotKey: "tue-ben-1", staffName: "Mr Ben O'Brien", day: "Tuesday", startLesson: 1, endLesson: 1, description: "Y10 GCSE Computer Science G2", courseSourceId: "60" },
  { slotKey: "tue-matthew-1", staffName: "Mr Matthew Shaper", day: "Tuesday", startLesson: 1, endLesson: 1, description: "Y11 GCSE Maths", courseSourceId: null },
  { slotKey: "tue-ben-2", staffName: "Mr Ben O'Brien", day: "Tuesday", startLesson: 2, endLesson: 2, description: "Y10 GCSE History G2", courseSourceId: "19" },
  { slotKey: "tue-matthew-2", staffName: "Mr Matthew Shaper", day: "Tuesday", startLesson: 2, endLesson: 2, description: "Y11 GCSE Digital Tech G2", courseSourceId: "11" },
  { slotKey: "tue-ben-3", staffName: "Mr Ben O'Brien", day: "Tuesday", startLesson: 3, endLesson: 3, description: "Y10 GCSE History G2", courseSourceId: "19" },
  { slotKey: "tue-matthew-3", staffName: "Mr Matthew Shaper", day: "Tuesday", startLesson: 3, endLesson: 3, description: "Cover Lessons", courseSourceId: null },
  { slotKey: "tue-ben-4", staffName: "Mr Ben O'Brien", day: "Tuesday", startLesson: 4, endLesson: 4, description: "Admin Work", courseSourceId: null },
  { slotKey: "tue-ben-5", staffName: "Mr Ben O'Brien", day: "Tuesday", startLesson: 5, endLesson: 5, description: "Y8 Higher Maths", courseSourceId: "48" },
  { slotKey: "tue-matthew-5", staffName: "Mr Matthew Shaper", day: "Tuesday", startLesson: 5, endLesson: 5, description: "Y10 Non GCSE IT G2", courseSourceId: null },
  { slotKey: "tue-ben-6", staffName: "Mr Ben O'Brien", day: "Tuesday", startLesson: 6, endLesson: 6, description: "Y11 GCSE Digital Tech G1", courseSourceId: "10" },
  { slotKey: "tue-matthew-6", staffName: "Mr Matthew Shaper", day: "Tuesday", startLesson: 6, endLesson: 6, description: "Y10 Non GCSE IT G2", courseSourceId: null },

  { slotKey: "wed-ben-1", staffName: "Mr Ben O'Brien", day: "Wednesday", startLesson: 1, endLesson: 1, description: "Y7 IT G1", courseSourceId: "1" },
  { slotKey: "wed-matthew-1", staffName: "Mr Matthew Shaper", day: "Wednesday", startLesson: 1, endLesson: 2, description: "Y11 GCSE Maths", courseSourceId: null },
  { slotKey: "wed-ben-2", staffName: "Mr Ben O'Brien", day: "Wednesday", startLesson: 2, endLesson: 2, description: "Y10 GCSE History G2", courseSourceId: "19" },
  { slotKey: "wed-ben-3", staffName: "Mr Ben O'Brien", day: "Wednesday", startLesson: 3, endLesson: 4, description: "Time out Room", courseSourceId: null },
  { slotKey: "wed-matthew-3", staffName: "Mr Matthew Shaper", day: "Wednesday", startLesson: 3, endLesson: 4, description: "Y7 IT G2", courseSourceId: "2" },
  { slotKey: "wed-ben-5", staffName: "Mr Ben O'Brien", day: "Wednesday", startLesson: 5, endLesson: 5, description: "Y10 GCSE Computer Science", courseSourceId: "60" },
  { slotKey: "wed-matthew-5", staffName: "Mr Matthew Shaper", day: "Wednesday", startLesson: 5, endLesson: 5, description: "Free lesson (Admin work)", courseSourceId: null },
  { slotKey: "wed-ben-6", staffName: "Mr Ben O'Brien", day: "Wednesday", startLesson: 6, endLesson: 6, description: "Y10 GCSE Digital Tech", courseSourceId: "8" },
  { slotKey: "wed-matthew-6", staffName: "Mr Matthew Shaper", day: "Wednesday", startLesson: 6, endLesson: 6, description: "Y11 GCSE Digital Tech G2", courseSourceId: "11" },

  { slotKey: "thu-ben-1", staffName: "Mr Ben O'Brien", day: "Thursday", startLesson: 1, endLesson: 1, description: "Y10 Non GCSE IT G1", courseSourceId: "7" },
  { slotKey: "thu-matthew-1", staffName: "Mr Matthew Shaper", day: "Thursday", startLesson: 1, endLesson: 2, description: "Admin Work", courseSourceId: null },
  { slotKey: "thu-ben-2", staffName: "Mr Ben O'Brien", day: "Thursday", startLesson: 2, endLesson: 2, description: "Y11 GCSE Digital Tech G1", courseSourceId: "10" },
  { slotKey: "thu-ben-3", staffName: "Mr Ben O'Brien", day: "Thursday", startLesson: 3, endLesson: 3, description: "Y10 Non GCSE IT G1", courseSourceId: "7" },
  { slotKey: "thu-matthew-3", staffName: "Mr Matthew Shaper", day: "Thursday", startLesson: 3, endLesson: 4, description: "Cover Lesson", courseSourceId: null },
  { slotKey: "thu-ben-4", staffName: "Mr Ben O'Brien", day: "Thursday", startLesson: 4, endLesson: 4, description: "Admin Work", courseSourceId: null },
  { slotKey: "thu-ben-5", staffName: "Mr Ben O'Brien", day: "Thursday", startLesson: 5, endLesson: 5, description: "Y10 GCSE Computer Science", courseSourceId: "60" },
  { slotKey: "thu-ben-6", staffName: "Mr Ben O'Brien", day: "Thursday", startLesson: 6, endLesson: 6, description: "Y10 GCSE Digital Tech", courseSourceId: "8" },
  { slotKey: "thu-matthew-6", staffName: "Mr Matthew Shaper", day: "Thursday", startLesson: 6, endLesson: 6, description: "Y11 GCSE Digital Tech G2", courseSourceId: "11" },

  { slotKey: "fri-ben-1", staffName: "Mr Ben O'Brien", day: "Friday", startLesson: 1, endLesson: 2, description: "Admin Work", courseSourceId: null },
  { slotKey: "fri-matthew-1", staffName: "Mr Matthew Shaper", day: "Friday", startLesson: 1, endLesson: 2, description: "Cover Lesson", courseSourceId: null },
  { slotKey: "fri-ben-3", staffName: "Mr Ben O'Brien", day: "Friday", startLesson: 3, endLesson: 4, description: "Admin Work / One to one with my team", courseSourceId: null },
  { slotKey: "fri-matthew-3", staffName: "Mr Matthew Shaper", day: "Friday", startLesson: 3, endLesson: 4, description: "Time out Room", courseSourceId: null },
  { slotKey: "fri-ben-5", staffName: "Mr Ben O'Brien", day: "Friday", startLesson: 5, endLesson: 5, description: "Y8 IT G2", courseSourceId: "4" },
  { slotKey: "fri-matthew-5", staffName: "Mr Matthew Shaper", day: "Friday", startLesson: 5, endLesson: 5, description: "Y10 Foundation Maths", courseSourceId: "54" },
  { slotKey: "fri-ben-6", staffName: "Mr Ben O'Brien", day: "Friday", startLesson: 6, endLesson: 6, description: "Y11 GCSE Digital Tech G1", courseSourceId: "10" },
  { slotKey: "fri-matthew-6", staffName: "Mr Matthew Shaper", day: "Friday", startLesson: 6, endLesson: 6, description: "Admin Work", courseSourceId: null },
];

export function resolveMaintainedTimetable(
  rows: MaintainedTimetableRow[],
  courses: TimetableCourseIdentity[],
): { slots: ImportedTimetableSlot[]; skipped: number; errors: string[] } {
  const slots: ImportedTimetableSlot[] = [];
  const errors: string[] = [];
  let skipped = 0;
  const seenKeys = new Set<string>();

  for (const row of rows) {
    if (!row.description.trim() || row.courseSourceId === null) {
      skipped++;
      continue;
    }
    if (seenKeys.has(row.slotKey)) {
      errors.push(`Duplicate maintained timetable slot key: ${row.slotKey}`);
      continue;
    }
    seenKeys.add(row.slotKey);

    const start = LESSON_TIMES[row.startLesson];
    const end = LESSON_TIMES[row.endLesson];
    if (!start || !end || row.endLesson < row.startLesson) {
      errors.push(`Invalid lesson range for ${row.slotKey}`);
      continue;
    }

    const legacyCode = legacyCourseCode(row.courseSourceId);
    const course =
      courses.find(candidate => candidate.sourceId === row.courseSourceId) ??
      courses.find(candidate => legacyCode !== null && candidate.code === legacyCode);
    if (!course) {
      skipped++;
      errors.push(`${row.slotKey}: no course found for source id ${row.courseSourceId}`);
      continue;
    }

    slots.push({
      courseId: course.id,
      day: row.day,
      startTime: start.start,
      endTime: end.end,
      room: course.room,
      staffName: row.staffName,
      weekPattern: "Every week",
      source: TECHNOLOGY_TIMETABLE_SOURCE,
      sourceKey: row.slotKey,
    });
  }

  return { slots, skipped, errors };
}

export function findStaleImportedSlotIds(
  existing: ExistingImportedSlot[],
  desiredSourceKeys: string[],
): number[] {
  const desired = new Set(desiredSourceKeys);
  return existing
    .filter(
      slot =>
        slot.source === TECHNOLOGY_TIMETABLE_SOURCE &&
        slot.sourceKey !== null &&
        !desired.has(slot.sourceKey),
    )
    .map(slot => slot.id);
}