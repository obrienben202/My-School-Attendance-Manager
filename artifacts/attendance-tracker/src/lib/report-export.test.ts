import assert from "node:assert/strict";
import test from "node:test";
import type { ReportResponse } from "@workspace/api-client-react";
import { createReportExportBlob, reportFilename } from "./report-export.ts";

const report: ReportResponse = {
  reportId: "sg-planned-absence",
  title: "Planned Absence / Summary",
  description: "Current requests",
  columns: [{ key: "reason", label: "Reason" }, { key: "date", label: "Date" }, { key: "attendance", label: "Attendance" }],
  rows: [['College, visit\n"confirmed"', "2026-09-01", "75.5%", '=HYPERLINK("https://example.test")']],
  appliedFilters: { status: "Awaiting Decision", dateFrom: "2026-09-01" },
  rowCount: 1,
  generatedAt: "2026-09-01T10:11:12.000Z",
  asOf: "2026-09-01T10:11:12.000Z",
};

test("CSV export includes metadata and preserves escaped values", async () => {
  const blob = createReportExportBlob(report, "csv");
  const value = await blob.text();
  assert.equal(blob.type, "text/csv;charset=utf-8");
  assert.match(value, /"Report","Planned Absence \/ Summary"/);
  assert.match(value, /"Filter: status","Awaiting Decision"/);
  assert.match(value, /"College, visit\n""confirmed"""/);
  assert.match(value, /"2026-09-01"/);
  assert.match(value, /"75\.5%"/);
  assert.match(value, /"'=HYPERLINK\(""https:\/\/example\.test""\)"/);
});

test("Excel-compatible export includes metadata and text-safe cells", async () => {
  const blob = createReportExportBlob(report, "xls");
  const value = await blob.text();
  assert.equal(blob.type, "application/vnd.ms-excel");
  assert.match(value, /Generated at/);
  assert.match(value, /College, visit\n&quot;confirmed&quot;/);
  assert.match(value, /mso-number-format:'\\@'/);
  assert.match(value, /2026-09-01/);
  assert.match(value, /&#39;=HYPERLINK/);
});

test("safe report filenames contain no path punctuation", () => {
  assert.equal(
    reportFilename(report, "csv"),
    "planned-absence-summary-2026-09-01T10-11-12-000Z.csv",
  );
});

test("empty reports cannot be downloaded", () => {
  assert.throws(
    () => createReportExportBlob({ ...report, rows: [], rowCount: 0 }, "csv"),
    /no rows to download/i,
  );
});