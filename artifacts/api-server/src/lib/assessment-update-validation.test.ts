import assert from "node:assert/strict";
import test from "node:test";
import { allowlistedUpdate } from "../routes/assessments";

test("server-owned timestamps and identifiers cannot enter assessment updates", () => {
  const allowed = new Set(["status", "result"]);
  assert.deepEqual(
    allowlistedUpdate({
      id: 9,
      status: "Released",
      result: "72",
      createdAt: "2000-01-01T00:00:00Z",
      updatedAt: "2000-01-01T00:00:00Z",
      gradeReleasedAt: "2000-01-01T00:00:00Z",
    }, allowed),
    { status: "Released", result: "72" },
  );
});