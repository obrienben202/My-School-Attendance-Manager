import assert from "node:assert/strict";
import test from "node:test";
import type { AuthUser } from "@workspace/api-zod";
import {
  normalizeDirectoryRole,
  normalizeDirectoryUsername,
  parseDirectoryCsv,
  planUserReconciliation,
  syncUsersFromDirectory,
} from "./user-directory";
import { resolveCurrentSessionUser } from "./session-user";

const header = "Username,Password,Role,Full Name,Department";

test("normalizes documented directory role aliases and usernames", () => {
  assert.equal(normalizeDirectoryRole(" ADMINISTRATOR "), "admin");
  assert.equal(normalizeDirectoryRole("hr"), "admin");
  assert.equal(normalizeDirectoryRole("Head of Department"), "hod");
  assert.equal(normalizeDirectoryRole("TEACHER"), "staff");
  assert.equal(normalizeDirectoryRole("Office Staff"), "office");
  assert.equal(normalizeDirectoryUsername("  Jane.DOE  "), "jane.doe");
});

test("rejects unknown and blank roles instead of defaulting to staff", () => {
  assert.throws(() => normalizeDirectoryRole(""), /blank/);
  assert.throws(() => normalizeDirectoryRole("supervisor"), /Unknown/);

  const parsed = parseDirectoryCsv([
    header,
    "known,secret,staff,Known User,Science",
    "blank,secret,,Blank Role,Science",
    "unknown,secret,supervisor,Unknown Role,Science",
  ].join("\n"));

  assert.equal(parsed.safe, false);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.invalid.length, 2);
});

test("parses quoted commas and finds role by header rather than column position", () => {
  const parsed = parseDirectoryCsv([
    "Department,Full Name,Role,Password,Username",
    '"Design, Technology","O\'Brien, Ben",HoD,secret,"  BOBRIEN  "',
  ].join("\r\n"));

  assert.equal(parsed.safe, true);
  assert.deepEqual(parsed.records[0], {
    rowNumber: 2,
    username: "bobrien",
    password: "secret",
    role: "hod",
    fullName: "O'Brien, Ben",
    department: "Design, Technology",
  });
});

test("duplicate usernames are explicit and make the payload unsafe", () => {
  const parsed = parseDirectoryCsv([
    header,
    "JDOE,secret,staff,Jane Doe,English",
    " jdoe ,secret,admin,Jane Doe,English",
  ].join("\n"));

  assert.equal(parsed.safe, false);
  assert.equal(parsed.duplicates.length, 1);
  assert.match(parsed.errors[0], /duplicate username "jdoe"/);
});

test("header-only and blank directories are explicit validation failures", async () => {
  const headerOnly = await syncUsersFromDirectory(header);
  assert.equal(headerOnly.invalid, 1);
  assert.equal(headerOnly.duplicates, 0);
  assert.match(headerOnly.errors.at(-1) ?? "", /no valid user records/);

  const blank = await syncUsersFromDirectory("");
  assert.equal(blank.invalid, 1);
  assert.equal(blank.duplicates, 0);
  assert.equal(blank.updated, 0);
  assert.equal(blank.inserted, 0);
});

test("reconciliation plans inserts, role corrections, unchanged and unmatched accounts", () => {
  const parsed = parseDirectoryCsv([
    header,
    "existing,secret,admin,Existing User,Science",
    "same,secret,staff,Same User,English",
    "new.user,secret,office,New User,Office",
  ].join("\n"));
  assert.equal(parsed.safe, true);

  const plan = planUserReconciliation(parsed.records, [
    {
      id: "1",
      username: "existing",
      role: "staff",
      firstName: "Existing User",
      department: "Science",
      passwordHash: "hash",
    },
    {
      id: "2",
      username: "same",
      role: "staff",
      firstName: "Same User",
      department: "English",
      passwordHash: "hash",
    },
    {
      id: "3",
      username: "local.only",
      role: "staff",
      firstName: "Local Only",
      department: null,
      passwordHash: "hash",
    },
  ]);

  assert.deepEqual(plan.inserts.map((record) => record.username), ["new.user"]);
  assert.deepEqual(plan.updates.map((record) => record.username), ["existing"]);
  assert.deepEqual(plan.unchanged.map((record) => record.username), ["same"]);
  assert.deepEqual(plan.unmatched.map((record) => record.username), ["local.only"]);
});

test("current database role replaces a stale session role and deletion revokes it", () => {
  const snapshot: AuthUser = {
    id: "1",
    email: null,
    firstName: "Jane",
    lastName: null,
    profileImageUrl: null,
    role: "staff",
    username: "jane",
    department: null,
  };
  const current = {
    id: snapshot.id,
    email: snapshot.email,
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    profileImageUrl: snapshot.profileImageUrl,
    role: "admin",
    username: snapshot.username ?? null,
    department: snapshot.department ?? null,
  };

  assert.equal(resolveCurrentSessionUser(snapshot, current)?.role, "admin");
  assert.equal(resolveCurrentSessionUser(snapshot, null), null);
});