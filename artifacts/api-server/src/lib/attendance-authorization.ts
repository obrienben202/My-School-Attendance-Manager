import type { AuthUser } from "@workspace/api-zod";
import {
  normaliseStaffName,
  staffIdentityMatches,
  staffNamesMatch,
  type StaffIdentity,
} from "./staff-identity";

export type AttendanceScheduleAssignment = {
  scheduleStaffName: string | null;
  courseStaffName: string | null;
};

export type AttendanceScheduleAuditAssignment = AttendanceScheduleAssignment & {
  id: number;
  courseCode: string | null;
};

export type AttendanceScheduleAssignmentAudit = {
  scheduleCount: number;
  assignedCount: number;
  matchedCount: number;
  unmatchedCount: number;
  uniqueUnmatchedStaffCount: number;
  examples: Array<{
    scheduleId: number;
    courseCode: string | null;
    assignedStaffName: string;
    assignmentSource: "schedule" | "course";
  }>;
};

const MAX_ASSIGNMENT_AUDIT_EXAMPLES = 10;

function assignedStaffName(assignment: AttendanceScheduleAssignment): string | null {
  const scheduleName = assignment.scheduleStaffName?.trim();
  if (scheduleName) return scheduleName;
  const courseName = assignment.courseStaffName?.trim();
  return courseName || null;
}

export function isStaffAssignedToSchedule(
  staffName: string | null | undefined,
  assignment: AttendanceScheduleAssignment,
): boolean {
  return staffNamesMatch(assignedStaffName(assignment), staffName);
}

export function auditAttendanceScheduleAssignments(
  assignments: AttendanceScheduleAuditAssignment[],
  staffAccounts: StaffIdentity[],
): AttendanceScheduleAssignmentAudit {
  let assignedCount = 0;
  let unmatchedCount = 0;
  const unmatchedStaffNames = new Set<string>();
  const examples: AttendanceScheduleAssignmentAudit["examples"] = [];

  for (const assignment of assignments) {
    const staffName = assignedStaffName(assignment);
    if (!staffName) continue;
    assignedCount++;

    if (staffAccounts.some(identity => staffIdentityMatches(staffName, identity))) {
      continue;
    }

    unmatchedCount++;
    unmatchedStaffNames.add(normaliseStaffName(staffName));
    if (examples.length < MAX_ASSIGNMENT_AUDIT_EXAMPLES) {
      examples.push({
        scheduleId: assignment.id,
        courseCode: assignment.courseCode,
        assignedStaffName: staffName,
        assignmentSource: assignment.scheduleStaffName?.trim() ? "schedule" : "course",
      });
    }
  }

  return {
    scheduleCount: assignments.length,
    assignedCount,
    matchedCount: assignedCount - unmatchedCount,
    unmatchedCount,
    uniqueUnmatchedStaffCount: unmatchedStaffNames.size,
    examples,
  };
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

export function filterManageableAttendanceSchedules<
  T extends AttendanceScheduleAssignment,
>(user: AuthUser, assignments: T[]): T[] {
  return assignments.filter(assignment =>
    canManageAttendanceSchedule(user, assignment),
  );
}