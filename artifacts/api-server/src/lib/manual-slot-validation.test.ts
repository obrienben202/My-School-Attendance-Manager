import assert from "node:assert/strict";
import test from "node:test";
import { CreateSlotBody, UpdateSlotBody } from "./manual-slot-validation";

const slot = { startTime: "09:00", endTime: "10:00" };

test("creating a lesson normalizes a recognized weekday", () => {
  assert.equal(CreateSlotBody.parse({ ...slot, day: "  tUeSday  " }).day, "Tuesday");
  assert.equal(CreateSlotBody.parse({ ...slot, day: "Friday" }).day, "Friday");
});

test("creating a lesson requires a weekday", () => {
  for (const day of [undefined, null, "", "   "]) {
    const input = { ...slot, day };
    const result = CreateSlotBody.safeParse(input);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some(issue => issue.path[0] === "day"));
  }
});

test("unknown days and weekends are rejected with useful weekday guidance", () => {
  for (const day of ["Funday", "Saturday", "Sunday", "Mon"]) {
    for (const schema of [CreateSlotBody, UpdateSlotBody]) {
      const result = schema.safeParse({ ...slot, day });
      assert.equal(result.success, false);
      if (!result.success) assert.match(result.error.issues.find(issue => issue.path[0] === "day")?.message ?? "", /Monday.*Friday/);
    }
  }
});

test("updating an existing lesson may omit its legacy day, but cannot clear or corrupt it", () => {
  const result = UpdateSlotBody.parse({ ...slot, room: "New room" });
  assert.equal(Object.hasOwn(result, "day"), false);
  for (const day of [null, "", "   "]) {
    const parsed = UpdateSlotBody.safeParse({ ...slot, room: "New room", day });
    assert.equal(parsed.success, false);
    if (!parsed.success) assert.ok(parsed.error.issues.some(issue => issue.path[0] === "day"));
  }
  assert.equal(UpdateSlotBody.parse({ ...slot, day: "  wEDnesday " }).day, "Wednesday");
});