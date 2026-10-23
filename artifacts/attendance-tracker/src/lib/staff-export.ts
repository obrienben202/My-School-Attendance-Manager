import type { StaffSource } from "@workspace/api-client-react";

export const STAFF_EXPORT_COLUMNS = [
  { key: "staffCode", label: "Staff Code" },
  { key: "personCode", label: "Person Code" },
  { key: "fullName", label: "Staff Name" },
  { key: "organisation", label: "Organisations" },
] as const;

export type StaffExportFormat = "xls" | "csv" | "pdf" | "doc";

function staffExportValue(row: StaffSource, key: typeof STAFF_EXPORT_COLUMNS[number]["key"]) {
  const value = row[key];
  return value == null || value === "" ? "Not provided" : String(value);
}

function csvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] ?? character));
}

function buildStaffTableHtml(rows: StaffSource[]) {
  const header = STAFF_EXPORT_COLUMNS.map(column => `<th>${column.label}</th>`).join("");
  const body = rows.map(row =>
    `<tr>${STAFF_EXPORT_COLUMNS.map(column => `<td>${escapeHtml(staffExportValue(row, column.key))}</td>`).join("")}</tr>`
  ).join("");
  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function buildStaffPdf(rows: StaffSource[]) {
  const lines = [
    STAFF_EXPORT_COLUMNS.map(column => column.label).join(" | "),
    ...rows.map(row => STAFF_EXPORT_COLUMNS.map(column => staffExportValue(row, column.key)).join(" | ")),
  ].map(line => line.replace(/[^\x20-\x7E]/g, "?"));
  const linesPerPage = 46;
  const pageLines = Array.from({ length: Math.max(1, Math.ceil(lines.length / linesPerPage)) }, (_, index) =>
    lines.slice(index * linesPerPage, (index + 1) * linesPerPage)
  );
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const pageReferences: string[] = [];

  pageLines.forEach((page, index) => {
    const pageObjectNumber = 4 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageReferences.push(`${pageObjectNumber} 0 R`);
    const commands = [
      "BT",
      "/F1 9 Tf",
      "40 760 Td",
      ...page.map((line, lineIndex) => `${lineIndex ? "0 -14 Td\n" : ""}(${line.replace(/[\\()]/g, character => `\\${character}`)}) Tj`),
      "ET",
    ].join("\n");
    objects[pageObjectNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageReferences.join(" ")}] /Count ${pageReferences.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function filterStaffRows(rows: StaffSource[], filter: string) {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) return rows;
  return rows.filter(row =>
    `${row.staffCode ?? ""} ${row.personCode ?? ""} ${row.fullName} ${row.organisation ?? ""}`.toLowerCase().includes(normalizedFilter)
  );
}

export function createStaffExportBlob(rows: StaffSource[], format: StaffExportFormat) {
  if (rows.length === 0) {
    throw new Error("There are no staff records matching the current filter.");
  }

  if (format === "csv") {
    const csv = [
      STAFF_EXPORT_COLUMNS.map(column => csvValue(column.label)).join(","),
      ...rows.map(row => STAFF_EXPORT_COLUMNS.map(column => csvValue(staffExportValue(row, column.key))).join(",")),
    ].join("\r\n");
    return new Blob([`\uFEFF${csv}\r\n`], { type: "text/csv;charset=utf-8" });
  }
  if (format === "pdf") {
    return buildStaffPdf(rows);
  }

  const document = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Staff Search Results</title></head><body>${buildStaffTableHtml(rows)}</body></html>`;
  return new Blob([document], {
    type: format === "xls" ? "application/vnd.ms-excel" : "application/msword",
  });
}

export function downloadStaffResults(rows: StaffSource[], format: StaffExportFormat) {
  const content = createStaffExportBlob(rows, format);
  const url = URL.createObjectURL(content);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `staff-search-results.${format}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}