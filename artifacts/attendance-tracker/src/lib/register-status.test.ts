import assert from "node:assert/strict";
import test from "node:test";
import { API_TO_STATUS, STATUS_TO_API, statusFromApi } from "./register-status.ts";

test("all saved attendance statuses round-trip to the same register mark", () => {
  for (const code of ["P", "A", "L", "O", "E", "D"] as const) {
    const apiStatus = STATUS_TO_API[code];
    assert.ok(apiStatus);
    assert.equal(API_TO_STATUS[apiStatus], code);
    assert.equal(statusFromApi(apiStatus), code);
  }
});

test("unknown saved statuses reload as not yet marked instead of changing a known mark", () => {
  assert.equal(statusFromApi("unexpected"), "N");
});