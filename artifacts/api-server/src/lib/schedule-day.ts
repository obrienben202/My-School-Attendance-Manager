const DAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function getScheduleDayIndex(day: string | null | undefined): number | undefined {
  if (!day?.trim()) return undefined;
  return DAY_TO_INDEX[day.trim().toLowerCase()];
}

export function parseAttendanceDateOnly(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || formatAttendanceDateOnly(date) !== value
    ? undefined
    : date;
}

export function formatAttendanceDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Date-only attendance values are parsed as UTC dates. Using getUTCDay keeps
 * the comparison stable regardless of the server's local timezone.
 *
 * Schedules without a recognized timetable day are legacy/incomplete rows and
 * remain markable because there is no day value against which to validate.
 */
export function attendanceDateMatchesScheduleDay(
  date: Date,
  scheduleDay: string | null | undefined,
): boolean {
  const scheduleDayIndex = getScheduleDayIndex(scheduleDay);
  return scheduleDayIndex === undefined || date.getUTCDay() === scheduleDayIndex;
}
