import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { coursesTable } from "@workspace/db";
import {
  isRoleFixture, roleFixtureMaxAgeMs, roleFixtureName, roleFixturePrefix,
  roleFixtureStatus, staleRoleFixtureCondition,
} from "./course-slots-role-fixture";

const fixture = {
  id: 1,
  code: `${roleFixturePrefix}${randomUUID()}`,
  name: roleFixtureName,
  status: roleFixtureStatus,
  isActive: false,
  sourceId: null,
  staffName: null,
  headOfDepartment: null,
} as typeof coursesTable.$inferSelect;

test("only the exact role-check signature is recognized", () => {
  assert.equal(isRoleFixture(fixture), true);
  for (const changes of [
    { code: `${roleFixturePrefix}ordinary-course` },
    { code: `ordinary_${randomUUID()}` },
    { name: "Ordinary course" },
    { status: "active" },
    { isActive: true },
    { sourceId: "imported" },
    { staffName: "Teacher" },
    { headOfDepartment: "Head" },
  ]) {
    assert.equal(isRoleFixture({ ...fixture, ...changes }), false, JSON.stringify(changes));
  }
});

test("stale cleanup requires the full signature and an age cutoff in the delete predicate", () => {
  const cutoff = new Date("2026-01-01T00:00:00Z");
  assert.equal(roleFixtureMaxAgeMs, 24 * 60 * 60 * 1000);
  const query = new PgDialect().sqlToQuery(staleRoleFixtureCondition(cutoff)!);
  for (const field of [
    '"is_active"', '"source_id"', '"name"', '"status"', '"staff_name"',
    '"head_of_department"', '"code"', '"created_at"',
  ]) {
    assert.ok(query.sql.includes(field), `cleanup must constrain ${field}`);
  }
  assert.match(query.sql, /"code" ~/);
  assert.match(query.sql, /"created_at" </);
  assert.ok(query.params.includes(cutoff.toISOString()));
  assert.ok(query.params.includes(roleFixtureName));
  assert.ok(query.params.includes(roleFixtureStatus));
  assert.ok(query.params.includes("^__e2e_course_slots_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"));
});