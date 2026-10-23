export type CourseSourceRecord = {
  sourceId: string;
  code: string;
  name: string;
  room: string | null;
  staffName: string | null;
  headOfDepartment: string | null;
  yearGroup: string | null;
  enrolledCount: number;
};

export type CourseSheetParseResult = {
  records: CourseSourceRecord[];
  skipped: number;
  errors: string[];
};

export type ExistingCourseIdentity = {
  id: number;
  code: string;
  sourceId: string | null;
  isActive?: boolean;
};

function normaliseName(name: string): string {
  return name
    .replace(/\bO'?Brien\b/gi, "O'Brien")
    .replace(/\bO'?Connor\b/gi, "O'Connor")
    .trim();
}

function normaliseOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function legacyCourseCode(sourceId: string): string | null {
  if (!/^\d+$/.test(sourceId)) return null;
  return `C${sourceId.padStart(3, "0")}`;
}

export function parseCourseSheetRows(rows: string[][]): CourseSheetParseResult {
  const records: CourseSourceRecord[] = [];
  const errors: string[] = [];
  let skipped = 0;
  const seenCodes = new Set<string>();
  const seenSourceIds = new Set<string>();

  rows.slice(1).forEach((row, index) => {
    const values = Array.from({ length: 8 }, (_, column) => row[column]?.trim() ?? "");
    const [sourceId, code, name, room, rawStaff, rawHead, yearGroup, enrolledRaw] = values;
    const rowNumber = index + 2;

    if (!code && !name && !room && !rawStaff && !rawHead && !yearGroup) {
      skipped++;
      return;
    }

    if (!sourceId || !code || !name) {
      skipped++;
      errors.push(`Course sheet row ${rowNumber} is missing an id, code, or name`);
      return;
    }

    if (seenSourceIds.has(sourceId) || seenCodes.has(code)) {
      skipped++;
      errors.push(`Course sheet row ${rowNumber} duplicates source id or code`);
      return;
    }

    const enrolledCount = enrolledRaw === "" ? 0 : Number(enrolledRaw);
    if (!Number.isInteger(enrolledCount) || enrolledCount < 0) {
      skipped++;
      errors.push(`Course sheet row ${rowNumber} has an invalid enrolment count`);
      return;
    }

    seenSourceIds.add(sourceId);
    seenCodes.add(code);
    records.push({
      sourceId,
      code,
      name,
      room: normaliseOptional(room),
      staffName: rawStaff ? normaliseName(rawStaff) : null,
      headOfDepartment: rawHead ? normaliseName(rawHead) : null,
      yearGroup: normaliseOptional(yearGroup),
      enrolledCount,
    });
  });

  return { records, skipped, errors };
}

export function chooseCourseReconciliation(
  record: CourseSourceRecord,
  existing: ExistingCourseIdentity[],
): { targetId: number | null; duplicateIds: number[] } {
  const legacyCode = legacyCourseCode(record.sourceId);
  const candidates = existing.filter(
    course =>
      course.sourceId === record.sourceId ||
      course.code === record.code ||
      (legacyCode !== null && course.code === legacyCode),
  );

  const target =
    candidates.find(course => course.sourceId === record.sourceId) ??
    candidates.find(course => legacyCode !== null && course.code === legacyCode) ??
    candidates.find(course => course.code === record.code) ??
    null;

  return {
    targetId: target?.id ?? null,
    duplicateIds: candidates.filter(course => course.id !== target?.id).map(course => course.id),
  };
}

export function findStaleCourseIds(existingIds: number[], activeIds: number[]): number[] {
  const active = new Set(activeIds);
  return existingIds.filter(id => !active.has(id));
}