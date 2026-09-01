import type { ReportResponse } from "@workspace/api-client-react";

export type ReportExportFormat = "csv" | "xls";

function text(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function spreadsheetText(value: unknown) {
  const valueText = text(value);
  return /^[\s]*[=+\-@]/.test(valueText) ? `'${valueText}` : valueText;
}

function csvCell(value: unknown) {
  return `"${spreadsheetText(value).replace(/"/g, '""')}"`;
}

function html(value: unknown) {
  return text(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] ?? character));
}

export function reportFilename(report: ReportResponse, format: ReportExportFormat) {
  const title = report.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "report";
  const generated = new Date(report.generatedAt).toISOString().replace(/[:.]/g, "-");
  return `${title}-${generated}.${format}`;
}

export function createReportExportBlob(report: ReportResponse, format: ReportExportFormat) {
  if (report.rowCount === 0 || report.rows.length === 0) {
    throw new Error("This report has no rows to download.");
  }

  const generatedAt = new Date(report.generatedAt).toISOString();
  const filterEntries = Object.entries(report.appliedFilters);
  if (format === "csv") {
    const lines = [
      [csvCell("Report"), csvCell(report.title)].join(","),
      [csvCell("Generated at"), csvCell(generatedAt)].join(","),
      [csvCell("Source data as of"), csvCell(report.asOf ? new Date(report.asOf).toISOString() : "Not available")].join(","),
      ...filterEntries.map(([key, value]) => [csvCell(`Filter: ${key}`), csvCell(value)].join(",")),
      "",
      report.columns.map((column) => csvCell(column.label)).join(","),
      ...report.rows.map((row) => row.map(csvCell).join(",")),
    ];
    return new Blob([`\uFEFF${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  }

  const metadata = [
    ["Report", report.title],
    ["Generated at", generatedAt],
    ["Source data as of", report.asOf ? new Date(report.asOf).toISOString() : "Not available"],
    ...filterEntries.map(([key, value]) => [`Filter: ${key}`, value]),
  ].map(([label, value]) => `<tr><th>${html(label)}</th><td style="mso-number-format:'\\@'">${html(value)}</td></tr>`).join("");
  const headings = report.columns.map((column) => `<th>${html(column.label)}</th>`).join("");
  const rows = report.rows.map((row) =>
    `<tr>${row.map((value) => `<td style="mso-number-format:'\\@'">${html(spreadsheetText(value))}</td>`).join("")}</tr>`
  ).join("");
  const document = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${html(report.title)}</title></head><body>` +
    `<table>${metadata}</table><br><table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  return new Blob([`\uFEFF${document}`], { type: "application/vnd.ms-excel" });
}

export function downloadReport(report: ReportResponse, format: ReportExportFormat) {
  const blob = createReportExportBlob(report, format);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = reportFilename(report, format);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}