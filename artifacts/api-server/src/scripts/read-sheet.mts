import { ReplitConnectors } from "@replit/connectors-sdk";

const SPREADSHEET_ID = "1eHSs1LPFM0cgMQQ4YWJQV2d20RSCm7-_xOCAWBfGLPQ";
const connectors = new ReplitConnectors();

async function readRange(sheet: string, range: string) {
  const r = `'${sheet}'!${range}`;
  const resp = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(r)}`,
    { method: "GET" }
  );
  const data = await resp.json() as any;
  return data.values ?? [];
}

const [students, attendance, kpis] = await Promise.all([
  readRange("Students Roster", "A1:F50"),
  readRange("Attendance Log", "A1:F50"),
  readRange("KPIs", "A1:D20"),
]);

console.log("=== STUDENTS ROSTER ===");
students.forEach((r: string[], i: number) => console.log(`${i}: ${JSON.stringify(r)}`));
console.log("\n=== ATTENDANCE LOG ===");
attendance.forEach((r: string[], i: number) => console.log(`${i}: ${JSON.stringify(r)}`));
console.log("\n=== KPIs ===");
kpis.forEach((r: string[], i: number) => console.log(`${i}: ${JSON.stringify(r)}`));
