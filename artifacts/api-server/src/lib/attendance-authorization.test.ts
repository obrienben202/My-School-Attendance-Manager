import assert from "node:assert/strict";
import test from "node:test";
import type { AuthUser } from "@workspace/api-zod";
import {
  canManageAttendanceSchedule,
  isStaffAssignedToSchedule,
} from "./attendance-authorization";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: null,
    firstName: "Ben",
    lastName: "O'Brien",
    profileImageUrl: null,
    role: "staff",
    username: "ben",
    department: null,
    ...overrides,
  };
}

test("assigned staff can manage their lesson register", () => {
  assert.equal(
    canManageAttendanceSchedule(user(), {
      scheduleStaffName: "Mr Ben O’Brien",
      courseStaffName: "Mrs Claire Jones",
    }),
    true,
  );
});

test("course assignment is used when a schedule has no override", () => {
  assert.equal(
    canManageAttendanceSchedule(user(), {
      scheduleStaffName: null,
      courseStaffName: "Mr Ben O'Brien",
    }),
    true,
  );
});

test("a schedule override takes precedence over the course assignment", () => {
  assert.equal(
    canManageAttendanceSchedule(user(), {
      scheduleStaffName: "Mrs Claire Jones",
      courseStaffName: "Mr Ben O'Brien",
    }),
    false,
  );
  assert.equal(
    canManageAttendanceSchedule(user({ firstName: "Claire", lastName: "Jones" }), {
      scheduleStaffName: "Mrs Claire Jones",
      courseStaffName: "Mr Ben O'Brien",
    }),
    true,
  );
  assert.equal(
    isStaffAssignedToSchedule("Ben O'Brien", {
      scheduleStaffName: "Mrs Claire Jones",
      courseStaffName: "Mr Ben O'Brien",
    }),
    false,
  );
  assert.equal(
    isStaffAssignedToSchedule("Claire Jones", {
      scheduleStaffName: "Mrs Claire Jones",
      courseStaffName: "Mr Ben O'Brien",
    }),
    true,
  );
});

test("unassigned staff cannot manage another staff member's register", () => {
  assert.equal(
    canManageAttendanceSchedule(user({ firstName: "Matthew", lastName: "Shaper" }), {
      scheduleStaffName: "Mr Ben O'Brien",
      courseStaffName: "Mr Ben O'Brien",
    }),
    false,
  );
});

test("admins and heads of department can manage any lesson register", () => {
  const assignment = {
    scheduleStaffName: "Mr Ben O'Brien",
    courseStaffName: "Mr Ben O'Brien",
  };
  assert.equal(canManageAttendanceSchedule(user({ role: "admin" }), assignment), true);
  assert.equal(canManageAttendanceSchedule(user({ role: "hod" }), assignment), true);
});

test("office users do not receive a privileged mutation exception", () => {
  assert.equal(
    canManageAttendanceSchedule(user({ role: "office" }), {
      scheduleStaffName: "Mr Matthew Shaper",
      courseStaffName: "Mr Matthew Shaper",
    }),
    false,
  );
});