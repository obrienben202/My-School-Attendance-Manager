import type { ReplitConnectors } from "@replit/connectors-sdk";

export async function fetchSheet(connectors: Pick<ReplitConnectors, "proxy">,
  spreadsheetId: string, sheetName: string, completeSnapshot = false): Promise<string[][]> {
  // Sessions must be a complete snapshot, never a truncated first 2,000 rows.
  const range = encodeURIComponent(`'${sheetName}'!${completeSnapshot ? "A:Z" : "A1:Z2000"}`);
  const resp = await connectors.proxy("google-sheet",
    `/v4/spreadsheets/${spreadsheetId}/values/${range}`, { method: "GET" });
  if (!resp.ok) throw new Error(`${sheetName} fetch failed (HTTP ${resp.status}); check the tab name and spreadsheet access, then retry`);
  const data = await resp.json() as { values?: string[][]; error?: unknown } | null;
  if (!data || data.error || (data.values !== undefined && (!Array.isArray(data.values) ||
      data.values.some(row => !Array.isArray(row) || row.some(value => typeof value !== "string"))))) {
    throw new Error(`${sheetName} returned malformed sheet data; existing schedules were left unchanged`);
  }
  return data.values ?? [];
}