import assert from "node:assert/strict";
import test from "node:test";
import { slotSaveError } from "./slot-save-error.ts";

test("shows weekday and other field issues from a failed save", async () => {
  const response = new Response(JSON.stringify({
    error: "Invalid body",
    issues: [
      { path: ["day"], message: "Day must be Monday, Tuesday, Wednesday, Thursday or Friday" },
      { path: ["startTime"], message: "Invalid time" },
    ],
  }), { status: 400 });
  const error = await slotSaveError(response, "Could not save slot. Please try again.");
  assert.equal(error.message, "Day: Day must be Monday, Tuesday, Wednesday, Thursday or Friday Start time: Invalid time");
});

test("shows a useful server error or fallback when issues are unavailable", async () => {
  assert.equal((await slotSaveError(new Response('{"error":"Slot not found"}', { status: 404 }), "Save failed")).message, "Slot not found");
  assert.equal((await slotSaveError(new Response("Not JSON", { status: 500 }), "Save failed")).message, "Save failed");
  assert.equal((await slotSaveError(new Response('{"error":"Invalid body"}', { status: 400 }), "Save failed")).message, "Save failed");
});