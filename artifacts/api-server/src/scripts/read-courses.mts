import { ReplitConnectors } from "@replit/connectors-sdk";

const SHEET_ID = "1C_FLnvrEZGpjHKpJ1bHOqt1JeYw07BgtlIDLvQ1aa9M";
const c = new ReplitConnectors();

const range = encodeURIComponent(`'Sheet1'!A1:H500`);
const r = await c.proxy("google-sheet", `/v4/spreadsheets/${SHEET_ID}/values/${range}`, { method: "GET" });
const d = await r.json() as any;
console.log(`Total rows including header: ${d.values?.length ?? 0}`);
(d.values ?? []).forEach((row: string[], i: number) => console.log(`${i}: ${JSON.stringify(row)}`));
