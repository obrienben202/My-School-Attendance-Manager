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
