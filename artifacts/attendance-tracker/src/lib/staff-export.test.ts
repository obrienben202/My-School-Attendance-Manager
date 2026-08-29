import assert from "node:assert/strict";
import test from "node:test";
import type { StaffSource } from "@workspace/api-client-react";
import { createStaffExportBlob, filterStaffRows, STAFF_EXPORT_COLUMNS } from "./staff-export.ts";
import { getPagination } from "./pagination.ts";

const staff: StaffSource[] = [
  {
    id: 1,
    staffCode: "ST-001",
    personCode: "P-101",
    fullName: 'Ava "Ace" Adams',
    firstName: "Ava",
    lastName: "Adams",
    title: "Ms",
    organisation: "Science & Technology",
  },
  {
    id: 2,
    staffCode: "ST-002",
    personCode: "P-102",
    fullName: "Ben Brown",
    firstName: "Ben",
    lastName: "Brown",
    title: "Mr",
    organisation: "English",
  },
];

test("staff filtering matches the displayed fields", () => {
  assert.deepEqual(filterStaffRows(staff, "science"), [staff[0]]);
  assert.deepEqual(filterStaffRows(staff, "P-102"), [staff[1]]);
  assert.deepEqual(filterStaffRows(staff, ""), staff);
});

test("CSV export includes displayed columns and only the filtered rows", async () => {
  const blob = createStaffExportBlob(filterStaffRows(staff, "science"), "csv");
  const text = await blob.text();

  assert.equal(blob.type, "text/csv;charset=utf-8");
  for (const column of STAFF_EXPORT_COLUMNS) assert.match(text, new RegExp(column.label));
  assert.match(text, /ST-001/);
  assert.match(text, /"Ava ""Ace"" Adams"/);
  assert.doesNotMatch(text, /ST-002/);
});

test("XLS, PDF, and DOC exports have honest file payloads", async () => {
  const xls = createStaffExportBlob(staff, "xls");
  const pdf = createStaffExportBlob(staff, "pdf");
  const doc = createStaffExportBlob(staff, "doc");

  assert.equal(xls.type, "application/vnd.ms-excel");
  assert.match(await xls.text(), /<th>Staff Code<\/th>/);
  assert.match(await xls.text(), /Science &amp; Technology/);
  assert.equal(pdf.type, "application/pdf");
  assert.match(await pdf.text(), /^%PDF-1\.4/);
  assert.equal(doc.type, "application/msword");
  assert.match(await doc.text(), /<title>Staff Search Results<\/title>/);
});

test("empty exports fail clearly", () => {
  assert.throws(
    () => createStaffExportBlob([], "csv"),
    /no staff records matching the current filter/i,
  );
});

test("pagination clamps to real boundaries", () => {
  assert.deepEqual(getPagination(0, 5, 10), {
    totalPages: 0,
    currentPage: 0,
    startIndex: 0,
    endIndex: 0,
    canGoPrevious: false,
    canGoNext: false,
  });
  assert.deepEqual(getPagination(12, 0, 5), {
    totalPages: 3,
    currentPage: 0,
    startIndex: 0,
    endIndex: 5,
    canGoPrevious: false,
    canGoNext: true,
  });
  assert.deepEqual(getPagination(12, 99, 5), {
    totalPages: 3,
    currentPage: 2,
    startIndex: 10,
    endIndex: 12,
    canGoPrevious: true,
    canGoNext: false,
  });
});