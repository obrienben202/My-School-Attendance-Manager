import assert from "node:assert/strict";
import test from "node:test";
import { validateSafeguardingNoteInput } from "./safeguarding-note-validation";

test("accepts a valid safeguarding note", () => {
  assert.equal(validateSafeguardingNoteInput({ studentId: 12, content: "Follow-up completed." }), null);
});

test("rejects missing learners and blank notes with clear guidance", () => {
  assert.equal(
    validateSafeguardingNoteInput({ studentId: 0, content: "Follow-up completed." }),
    "Select a learner before sending the note.",
  );
  assert.equal(
    validateSafeguardingNoteInput({ studentId: 12, content: "   " }),
    "Enter a note before sending.",
  );
});

test("rejects notes beyond the protected workflow limit", () => {
  assert.equal(
    validateSafeguardingNoteInput({ studentId: 12, content: "x".repeat(10_001) }),
    "The note must be 10,000 characters or fewer.",
  );
});