import assert from "node:assert/strict";
import test from "node:test";
import { profileForUsername } from "./self-profile";

const csv = [
  "Username,Password,Role,Full Name,Department,Email,Phone,Address,Postcode,Staff Code,Job Title,Organisation,Start Date",
  'alpha,secret,staff,A. Person,Science,alpha@example.org,01234 567890,"10 High Street, London",AB1 2CD,A-01,Tutor,School A,2020-09-01',
  "beta,secret,admin,B. Person,English,beta@example.org,999,Elsewhere,ZZ9 9ZZ,B-02,Principal,School B,2021-02-30",
].join("\n");

test("self profile selects only the exact username and explicit verified columns", () => {
  assert.deepEqual(profileForUsername(csv, " ALPHA "), {
    email: "alpha@example.org", phone: "01234 567890", address: "10 High Street, London",
    postcode: "AB1 2CD", staffCode: "A-01", jobTitle: "Tutor",
    organisation: "School A", startDate: "2020-09-01",
  });
  assert.equal(profileForUsername(csv, "beta").startDate, null);
  assert.ok(Object.values(profileForUsername(csv, "alpha")).every(value => value !== "secret"));
});

test("missing identity or columns return null rather than a different person's details", () => {
  assert.ok(Object.values(profileForUsername(csv, "unknown")).every(value => value === null));
  assert.ok(Object.values(profileForUsername("Username,Password,Role\nalpha,secret,staff", "alpha")).every(value => value === null));
});

test("invalid or duplicate directory records fail closed", () => {
  assert.throws(() => profileForUsername(csv + "\nALPHA,secret,staff", "alpha"), /invalid/);
  assert.throws(() => profileForUsername("Username,Password,Role\nalpha,secret,invalid", "alpha"), /invalid/);
});