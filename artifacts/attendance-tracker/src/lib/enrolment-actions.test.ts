import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAgreementHandoff,
  MAX_ENROLMENT_PHOTO_BYTES,
  validateEnrolmentPhoto,
} from "./enrolment-actions.ts";

test("accepts supported photos within the size limit", () => {
  assert.equal(validateEnrolmentPhoto({ type: "image/jpeg", size: 1024 }), "");
  assert.equal(validateEnrolmentPhoto({ type: "image/png", size: MAX_ENROLMENT_PHOTO_BYTES }), "");
});

test("rejects unsupported, empty, and oversized photos", () => {
  assert.match(validateEnrolmentPhoto({ type: "image/gif", size: 1024 }), /JPEG or PNG/i);
  assert.match(validateEnrolmentPhoto({ type: "image/png", size: 0 }), /empty/i);
  assert.match(
    validateEnrolmentPhoto({ type: "image/png", size: MAX_ENROLMENT_PHOTO_BYTES + 1 }),
    /smaller than 5MB/i,
  );
});

test("builds a correctly addressed and prefilled agreement handoff", () => {
  const result = buildAgreementHandoff({
    recipient: "emma@example.com",
    learnerName: "Emma Davies",
    courseName: "A-Level Mathematics",
    courseCode: "AMAT01",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.mailto, /^mailto:emma%40example\.com\?/);
  assert.match(decodeURIComponent(result.mailto), /Learning agreement for Emma Davies/);
  assert.match(decodeURIComponent(result.mailto), /A-Level Mathematics \(AMAT01\)/);
});

test("reports missing or invalid learner contact and enrolment data", () => {
  assert.deepEqual(
    buildAgreementHandoff({
      recipient: "",
      learnerName: "Emma Davies",
      courseName: "Mathematics",
      courseCode: "AMAT01",
    }),
    { ok: false, error: "Add a learner email address before preparing the agreement." },
  );
  const invalidEmail = buildAgreementHandoff({
    recipient: "not-an-email",
    learnerName: "Emma Davies",
    courseName: "Mathematics",
    courseCode: "AMAT01",
  });
  assert.equal(invalidEmail.ok, false);
  const missingCourse = buildAgreementHandoff({
    recipient: "emma@example.com",
    learnerName: "Emma Davies",
    courseName: "",
    courseCode: "AMAT01",
  });
  assert.equal(missingCourse.ok, false);
});