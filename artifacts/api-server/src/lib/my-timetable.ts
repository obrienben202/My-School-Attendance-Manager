import { isStaffAssignedToSchedule } from "./attendance-authorization";
import { staffNamesMatch } from "./staff-identity";

type CourseSlot = {
  id: number;
  day: string | null;
  startTime: string;
  endTime: string;
  room: string | null;
  weekPattern: string;
  scheduleStaffName: string | null;
  courseStaffName: string | null;
  courseName: string;
  courseCode: string;
};

type StaffSlot = {
  id: number;
  staffName: string | null;
  isHodShared: boolean;
  day: string;
  startTime: string;
  endTime: string;
  description: string;
  groupLabel: string | null;
  room: string | null;
};

export function buildMyTimetable(
  courseSlots: CourseSlot[],
  staffSlots: StaffSlot[],
  staffName: string,
  role: string | undefined,
) {
  const canSeeShared = role === "hod" || role === "admin";
  const teaching = courseSlots
    .filter(row => isStaffAssignedToSchedule(staffName, row))
    .map(row => ({
      id: `course-${row.id}`,
      day: row.day ?? "Unscheduled",
      startTime: row.startTime,
      endTime: row.endTime,
      description: `${row.courseCode} — ${row.courseName}`,
      groupLabel: null as string | null,
      room: row.room,
      weekPattern: row.weekPattern,
    }));
  const activities = staffSlots
    .filter(row => row.isHodShared ? canSeeShared : staffNamesMatch(row.staffName, staffName))
    .map(row => ({
      id: `staff-${row.id}`,
      day: row.day,
      startTime: row.startTime,
      endTime: row.endTime,
      description: row.description,
      groupLabel: row.groupLabel,
      room: row.room,
      weekPattern: null as string | null,
    }));

  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return [...teaching, ...activities].sort((a, b) =>
    (dayOrder.indexOf(a.day) < 0 ? dayOrder.length : dayOrder.indexOf(a.day)) -
    (dayOrder.indexOf(b.day) < 0 ? dayOrder.length : dayOrder.indexOf(b.day)) ||
    a.startTime.localeCompare(b.startTime) ||
    a.id.localeCompare(b.id)
  );
}