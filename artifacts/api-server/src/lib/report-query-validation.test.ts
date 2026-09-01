import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { GetReportParams } from "@workspace/api-zod";
import { parseQuery } from "../routes/reports";

function request(query: Request["query"]): Request {
  return { query } as Request;
}

test("report identifiers are contract validated", () => {
  assert.equal(GetReportParams.safeParse({ reportId: "att-overall" }).success, true);
  assert.equal(GetReportParams.safeParse({ reportId: "att-register-progress" }).success, true);
  assert.equal(GetReportParams.safeParse({ reportId: "not-a-report" }).success, false);
});

test("report filters reject unknown, inapplicable, and malformed values", () => {
  assert.match(parseQuery(request({ unexpected: "x" }), "att-overall").error ?? "", /unknown report filter/i);
  assert.match(parseQuery(request({ tutor: "Smith" }), "att-overall").error ?? "", /not a filter/i);
  assert.match(parseQuery(request({ threshold: "anything" }), "att-punctuality").error ?? "", /invalid threshold/i);
  assert.match(parseQuery(request({ dateFrom: "2026-09-02", dateTo: "2026-09-01" }), "att-overall").error ?? "", /before/i);
  assert.match(parseQuery(request({ status: "Maybe" }), "sg-planned-absence").error ?? "", /invalid planned absence status/i);
  assert.match(parseQuery(request({ completion: "Individual marks" }), "att-register-progress").error ?? "", /invalid register completion/i);
});

test("valid report filters retain date-only values without timezone conversion in labels", () => {
  const parsed = parseQuery(request({
    dateFrom: "2026-09-01",
    dateTo: "2026-09-02",
    course: "GCSE English",
  }), "att-learner");
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.data?.dateFrom?.toISOString().slice(0, 10), "2026-09-01");
  assert.equal(parsed.data?.dateTo?.toISOString().slice(0, 10), "2026-09-02");
});

test("register progress accepts only privacy-safe aggregate filters", () => {
  const parsed = parseQuery(request({
    dateFrom: "2026-09-01",
    course: "GCSE English",
    status: "Draft",
    completion: "Unmarked rows",
  }), "att-register-progress");
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.data?.status, "Draft");
  assert.equal(parsed.data?.completion, "Unmarked rows");
});