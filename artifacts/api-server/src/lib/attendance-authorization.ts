import type { AuthUser } from "@workspace/api-zod";
import { staffNamesMatch } from "./staff-identity";

export type AttendanceScheduleAssignment = {
  scheduleStaffName: string | null;
  courseStaffName: string | null;
};

export function isStaffAssignedToSchedule(
  staffName: string | null | undefined,
  assignment: AttendanceScheduleAssignment,
): boolean {
  const assignedStaffName = assignment.scheduleStaffName?.trim()
    ? assignment.scheduleStaffName
    : assignment.courseStaffName;
  return staffNamesMatch(assignedStaffName, staffName);
}

export function canManageAttendanceSchedule(
  user: AuthUser,
  assignment: AttendanceScheduleAssignment,
): boolean {
  if (user.role === "admin" || user.role === "hod") return true;

  const userDisplayName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    isStaffAssignedToSchedule(userDisplayName, assignment) ||
    isStaffAssignedToSchedule(user.username, assignment)
  );
}