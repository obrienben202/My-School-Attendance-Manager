import { coursesTable } from "@workspace/db";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

export const roleFixturePrefix = "__e2e_course_slots_";
export const roleFixtureName = "E2E role check fixture";
export const roleFixtureStatus = "e2e-role-fixture";
export const roleFixtureMaxAgeMs = 24 * 60 * 60 * 1000;

// Only the exact UUID-shaped codes minted by the role check can be reclaimed.
const roleFixtureCode = /^__e2e_course_slots_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const roleFixtureCodeSql = "^__e2e_course_slots_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export function isRoleFixture(course: typeof coursesTable.$inferSelect) {
  return !course.isActive && course.sourceId === null &&
    course.name === roleFixtureName && course.status === roleFixtureStatus &&
    course.staffName === null && course.headOfDepartment === null &&
    roleFixtureCode.test(course.code);
}

export function staleRoleFixtureCondition(cutoff: Date) {
  return and(
    eq(coursesTable.isActive, false),
    isNull(coursesTable.sourceId),
    eq(coursesTable.name, roleFixtureName),
    eq(coursesTable.status, roleFixtureStatus),
    isNull(coursesTable.staffName),
    isNull(coursesTable.headOfDepartment),
    sql`${coursesTable.code} ~ ${roleFixtureCodeSql}`,
    lt(coursesTable.createdAt, cutoff),
  );
}