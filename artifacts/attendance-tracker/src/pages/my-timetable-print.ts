import type { PersonalSlot } from "./my-timetable-query.ts";
import { buildWeeklyTimetable, sessionDetails, sessionTime, timetableDays, type TimetableEntry } from "./my-timetable-presentation.ts";

export function escapeTimetableHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character] ?? character));
}
const escape = escapeTimetableHtml;

function sessionHtml({ slot, crossPeriod }: Pick<TimetableEntry, "slot" | "crossPeriod">) {
  return `<article><strong>${escape(slot.description)}</strong><div class="time">${escape(sessionTime(slot))}</div>${sessionDetails(slot) ? `<div>${escape(sessionDetails(slot))}</div>` : ""}${crossPeriod ? '<small>Spans lesson periods · full session time shown</small>' : ""}</article>`;
}

/** Pure document builder allows verifying the exact printed content without opening a browser. */
export function timetablePrintDocument(name: string, slots: readonly PersonalSlot[]) {
  const { rows, additional } = buildWeeklyTimetable(slots);
  const grid = rows.map(row => `<tr><th scope="row">${escape(row.label)}<span>${row.start}–${row.end}</span></th>${row.band
    ? `<td colspan="5" class="band">${escape(row.label)}</td>`
    : row.cells.map(cell => `<td>${cell.map(sessionHtml).join("")}</td>`).join("")}</tr>`).join("");
  const extra = additional.length ? `<section><h2>Additional / unplaced sessions</h2><p>These recorded sessions do not fit the lesson grid. No times have been changed.</p>${additional.map(entry =>
    `<div class="additional"><strong>${escape(entry.slot.day || "Day not recorded")}</strong>${sessionHtml({ slot: entry.slot, crossPeriod: false })}<small>${escape(entry.reason)}</small></div>`
  ).join("")}</section>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>My timetable</title><style>
    @page{size:A4 landscape;margin:10mm}
    *{box-sizing:border-box}body{font:11px system-ui,sans-serif;color:#23394a;background:white;margin:0}
    h1{font-size:22px;margin:0 0 4px}h2{font-size:16px}p{margin:4px 0 12px}
    table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}
    th,td{border:1px solid #9dacad;padding:7px;vertical-align:top;overflow-wrap:anywhere;text-align:left}
    thead th{text-align:center;background:#e9f5f2}th:first-child{width:13%}
    th span{display:block;font-weight:normal;margin-top:4px}.band{text-align:center;background:#f0f5f4;font-weight:bold}
    article{padding:5px;background:#f1f8f6;border:1px solid #dce6e7;margin-bottom:5px;break-inside:avoid}
    article:last-child{margin-bottom:0}article strong{display:block}.time{font-weight:600;margin:3px 0}small{display:block;margin-top:3px}
    .additional{border:1px solid #9dacad;padding:8px;margin:8px 0;break-inside:avoid}.additional article{margin-top:4px}
    @media screen{body{padding:24px;max-width:1400px;margin:auto}}
    @media print{body{width:100%}section{margin-top:12px}h2{break-after:avoid}}
    </style></head><body><h1>Timetable</h1><p>${escape(name || "Account")} · Teaching sessions and activities</p><table aria-label="Weekly personal timetable"><thead><tr><th scope="col">Lesson / Time</th>${timetableDays.map(day => `<th scope="col">${day}</th>`).join("")}</tr></thead><tbody>${grid}</tbody></table>${extra}</body></html>`;
}

export function printTimetable(name: string, slots: PersonalSlot[]) {
  const windowToPrint = window.open("", "_blank", "width=1200,height=800");
  if (!windowToPrint) return;
  windowToPrint.document.write(timetablePrintDocument(name, slots));
  windowToPrint.document.close();
  // Let the completed document and its system fonts settle before print preview.
  void windowToPrint.document.fonts.ready.then(() => {
    windowToPrint.focus();
    windowToPrint.print();
  });
}