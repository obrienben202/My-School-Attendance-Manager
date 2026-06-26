import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetStudent,
  useListAttendanceRecords,
  useListTargets,
  useListIlps,
  useListCourses,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, UserCircle2, Printer, Mail, Edit, PlusCircle, FileText, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Report helpers ───────────────────────────────────────────────────────────

type Student = { forename: string; middleNames?: string | null; surname: string; personCode?: string | null; dateOfBirth?: string | null; yearGroup?: string | null; attendancePercent?: number; punctualityPercent?: number };
type AttRec = { date: string; courseId: number; status: string; notes?: string | null };
type TargetRec = { title: string; description?: string | null; dueDate?: string | null; completed: boolean };
type IlpRec = { title: string; content?: string | null; status: string; createdAt: string };
type CourseRec = { id: number; code: string; name: string; room?: string | null; staffName?: string | null };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = ["09:00–10:00", "10:00–11:00", "11:15–12:15", "13:00–14:00", "14:00–15:00"];
const ENRICHMENT = [
  { activity: "Football Club", start: "2024-09-05", end: "2025-06-20", status: "Active" },
  { activity: "Duke of Edinburgh", start: "2024-10-01", end: "2025-05-30", status: "Active" },
  { activity: "Drama Society", start: "2024-09-10", end: "2025-03-31", status: "Completed" },
];
const WORK_EXP = [
  { employer: "City Council", start: "2025-01-13", end: "2025-01-17", hours: 35, supervisor: "J. Graham" },
  { employer: "Local Hospital", start: "2025-06-16", end: "2025-06-20", hours: 35, supervisor: "Dr T. Patel" },
];
const DISCIPLINARY = [
  { date: "2024-10-15", incident: "Late to class (3rd offence)", action: "Verbal warning", staff: "Mr Harris" },
  { date: "2024-11-08", incident: "Mobile phone use in lesson", action: "Phone confiscated, letter home", staff: "Ms Carter" },
];

function printReportWindow(title: string, html: string) {
  const w = window.open("", "_blank", "width=850,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#222;}
  h1{font-size:17px;margin-bottom:4px;}
  h2{font-size:13px;color:#555;font-weight:normal;margin-bottom:16px;}
  .meta{font-size:11px;color:#555;margin-bottom:16px;border-bottom:1px solid #ccc;padding-bottom:8px;}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;}
  th{background:#1e3a5f;color:#fff;text-align:left;padding:6px 8px;font-size:11px;}
  td{border-bottom:1px solid #e0e0e0;padding:5px 8px;font-size:11px;}
  tr:nth-child(even) td{background:#f8f8f8;}
  .badge-present{color:#166534;font-weight:bold;}
  .badge-absent{color:#991b1b;font-weight:bold;}
  .badge-late{color:#92400e;font-weight:bold;}
  .badge-done{color:#166534;}
  .badge-pending{color:#92400e;}
  .section-title{font-size:13px;font-weight:bold;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px;}
  @media print{body{margin:12px;}}
</style>
</head><body onload="window.print()">
${html}
</body></html>`);
  w.document.close();
}

function reportHeader(title: string, student: Student) {
  const name = [student.forename, student.middleNames, student.surname].filter(Boolean).join(" ");
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  return `<h1>${title}</h1>
<div class="meta">
  <strong>Learner:</strong> ${name} &nbsp;|&nbsp;
  <strong>Ref:</strong> ${student.personCode ?? "—"} &nbsp;|&nbsp;
  <strong>Year Group:</strong> ${student.yearGroup ?? "—"} &nbsp;|&nbsp;
  <strong>DOB:</strong> ${student.dateOfBirth ?? "—"} &nbsp;|&nbsp;
  <strong>Generated:</strong> ${today}
</div>`;
}

function buildReportHtml(
  reportName: string,
  student: Student,
  attendance: AttRec[],
  targets: TargetRec[],
  ilps: IlpRec[],
  courses: CourseRec[],
): string {
  const header = reportHeader(reportName, student);

  if (reportName === "Learner Timetable") {
    // Distribute courses into a 6-lesson × 5-day grid
    const cellMap: Record<string, CourseRec> = {};
    courses.forEach((c, i) => { cellMap[`${Math.floor(i / 5)}-${i % 5}`] = c; });
    const cell = (lesson: number, day: number) => {
      const c = cellMap[`${lesson}-${day}`];
      return c ? `<strong>${c.code}</strong><br/><span style="font-size:10px;color:#555;">${c.name}${c.room ? ` · ${c.room}` : ""}</span>` : "";
    };
    const dayRow = DAYS.map(d => `<th style="border:1px solid #bbb;padding:6px 4px;text-align:center;background:#f0f0f0;font-size:11px;">${d}</th>`).join("");
    const lessonRow = (label: string, idx: number) =>
      `<tr><td style="border:1px solid #bbb;padding:5px 6px;font-weight:bold;font-size:11px;background:#fafafa;white-space:nowrap;">${label}</td>` +
      DAYS.map((_, d) => `<td style="border:1px solid #bbb;padding:5px 6px;font-size:11px;min-width:100px;">${cell(idx, d)}</td>`).join("") +
      `</tr>`;
    const breakRow = (label: string) =>
      `<tr><td colspan="6" style="border:1px solid #bbb;padding:5px 6px;text-align:center;font-style:italic;font-size:12px;color:#555;background:#f9f9f9;">${label}</td></tr>`;
    return `${header}
<h2 style="text-align:center;font-size:15px;font-weight:bold;margin-bottom:10px;">Timetable</h2>
<table style="border-collapse:collapse;width:100%;">
  <thead>
    <tr>
      <th style="border:1px solid #bbb;padding:6px 4px;width:80px;background:#f0f0f0;"></th>
      ${dayRow}
    </tr>
  </thead>
  <tbody>
    ${lessonRow("Lesson 1", 0)}
    ${lessonRow("Lesson 2", 1)}
    ${breakRow("Break")}
    ${lessonRow("Lesson 3", 2)}
    ${lessonRow("Lesson 4", 3)}
    ${breakRow("Lunch")}
    ${lessonRow("Lesson 5", 4)}
    ${lessonRow("Lesson 6", 5)}
  </tbody>
</table>`;
  }

  if (reportName === "Attendance Report (Detailed)") {
    const att = attendance.length ? attendance : [];
    const present = att.filter(a => a.status === "present").length;
    const absent = att.filter(a => a.status === "absent").length;
    const late = att.filter(a => a.status === "late").length;
    const pct = att.length ? Math.round((present / att.length) * 100) : (student.attendancePercent ?? 0);
    const rows = att.slice(0, 50).map(a => {
      const course = courses.find(c => c.id === a.courseId);
      const cls = a.status === "present" ? "badge-present" : a.status === "absent" ? "badge-absent" : "badge-late";
      return `<tr>
        <td>${new Date(a.date).toLocaleDateString("en-GB")}</td>
        <td>${course ? `${course.code} — ${course.name}` : `Course ${a.courseId}`}</td>
        <td class="${cls}">${a.status.charAt(0).toUpperCase() + a.status.slice(1)}</td>
        <td>${a.notes ?? ""}</td>
      </tr>`;
    }).join("");
    return `${header}
<div class="section-title">Summary</div>
<table style="width:auto;margin-bottom:16px;">
  <thead><tr><th>Present</th><th>Absent</th><th>Late</th><th>Attendance %</th></tr></thead>
  <tbody><tr><td class="badge-present">${present}</td><td class="badge-absent">${absent}</td><td class="badge-late">${late}</td><td>${pct}%</td></tr></tbody>
</table>
<div class="section-title">Detailed Records</div>
<table>
  <thead><tr><th>Date</th><th>Course</th><th>Status</th><th>Notes</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="4">No attendance records found.</td></tr>'}</tbody>
</table>`;
  }

  if (reportName === "Achievement Report") {
    const done = targets.filter(t => t.completed).length;
    const pending = targets.filter(t => !t.completed).length;
    const rows = targets.map(t => `<tr>
      <td>${t.title}</td>
      <td>${t.description ?? "—"}</td>
      <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB") : "—"}</td>
      <td class="${t.completed ? "badge-done" : "badge-pending"}">${t.completed ? "Achieved" : "Pending"}</td>
    </tr>`).join("");
    return `${header}
<div class="section-title">Summary — ${done} achieved, ${pending} pending</div>
<table>
  <thead><tr><th>Target</th><th>Description</th><th>Due Date</th><th>Status</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="4">No achievement targets on record.</td></tr>'}</tbody>
</table>`;
  }

  if (reportName === "Disciplinary History") {
    const rows = DISCIPLINARY.map(d => `<tr>
      <td>${new Date(d.date).toLocaleDateString("en-GB")}</td>
      <td>${d.incident}</td>
      <td>${d.action}</td>
      <td>${d.staff}</td>
    </tr>`).join("");
    return `${header}
<table>
  <thead><tr><th>Date</th><th>Incident</th><th>Action Taken</th><th>Recorded By</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  if (reportName === "ILP Summary Report") {
    const rows = ilps.map(i => `<tr>
      <td>${i.title}</td>
      <td>${i.content ?? "—"}</td>
      <td>${i.status}</td>
      <td>${new Date(i.createdAt).toLocaleDateString("en-GB")}</td>
    </tr>`).join("");
    return `${header}
<table>
  <thead><tr><th>Target / Objective</th><th>Detail</th><th>Status</th><th>Created</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="4">No ILP entries on record.</td></tr>'}</tbody>
</table>`;
  }

  if (reportName === "Enrichment Activity Report") {
    const rows = ENRICHMENT.map(e => `<tr>
      <td>${e.activity}</td>
      <td>${new Date(e.start).toLocaleDateString("en-GB")}</td>
      <td>${new Date(e.end).toLocaleDateString("en-GB")}</td>
      <td class="${e.status === "Active" ? "badge-present" : "badge-done"}">${e.status}</td>
    </tr>`).join("");
    return `${header}
<table>
  <thead><tr><th>Activity</th><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  if (reportName === "Work Experience Log") {
    const rows = WORK_EXP.map(w => `<tr>
      <td>${w.employer}</td>
      <td>${new Date(w.start).toLocaleDateString("en-GB")}</td>
      <td>${new Date(w.end).toLocaleDateString("en-GB")}</td>
      <td>${w.hours}</td>
      <td>${w.supervisor}</td>
    </tr>`).join("");
    return `${header}
<table>
  <thead><tr><th>Employer</th><th>Start Date</th><th>End Date</th><th>Hours</th><th>Supervisor</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  return `${header}<p>Report content not available.</p>`;
}

// Status badges for the in-app preview
function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "present" ? "text-green-700 bg-green-50 border-green-200" :
    status === "absent" ? "text-red-700 bg-red-50 border-red-200" :
    status === "late" ? "text-amber-700 bg-amber-50 border-amber-200" :
    status === "Achieved" || status === "Active" ? "text-green-700 bg-green-50 border-green-200" :
    "text-slate-600 bg-slate-50 border-slate-200";
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`}>{status}</span>;
}

function StudentReportDialog({
  reportName, student, attendance, targets, ilps, courses, onClose,
}: {
  reportName: string | null;
  student: Student;
  attendance: AttRec[];
  targets: TargetRec[];
  ilps: IlpRec[];
  courses: CourseRec[];
  onClose: () => void;
}) {
  if (!reportName) return null;

  function handlePrint() {
    const html = buildReportHtml(reportName!, student, attendance, targets, ilps, courses);
    printReportWindow(reportName!, html);
  }

  const name = [student.forename, student.middleNames, student.surname].filter(Boolean).join(" ");
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  // ── In-dialog preview renderers ─────────────────────────────────────────

  function renderContent() {
    const tblHead = (...cols: string[]) => (
      <thead>
        <tr className="bg-teal-800 text-white text-[11px]">
          {cols.map(c => <th key={c} className="text-left px-3 py-1.5 font-semibold">{c}</th>)}
        </tr>
      </thead>
    );
    const empty = (cols: number) => (
      <tr><td colSpan={cols} className="px-3 py-6 text-center text-slate-400 text-xs">No records on file.</td></tr>
    );

    if (reportName === "Learner Timetable") {
      // Build a lesson×day cell map
      const cellMap: Record<string, CourseRec> = {};
      courses.forEach((c, i) => { cellMap[`${Math.floor(i / 5)}-${i % 5}`] = c; });
      const getCell = (lesson: number, day: number) => cellMap[`${lesson}-${day}`] ?? null;

      const LessonRow = ({ label, idx }: { label: string; idx: number }) => (
        <tr>
          <td className="border border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 whitespace-nowrap w-20">{label}</td>
          {DAYS.map((_, d) => {
            const c = getCell(idx, d);
            return (
              <td key={d} className="border border-slate-300 px-2 py-1.5 text-[10px] text-slate-700 min-w-[100px]">
                {c ? <><span className="font-semibold text-teal-800">{c.code}</span><br /><span className="text-slate-500">{c.name}{c.room ? ` · ${c.room}` : ""}</span></> : ""}
              </td>
            );
          })}
        </tr>
      );
      const BreakRow = ({ label }: { label: string }) => (
        <tr>
          <td colSpan={6} className="border border-slate-300 px-3 py-1.5 text-center text-xs italic text-slate-500 bg-slate-50">{label}</td>
        </tr>
      );

      return (
        <div className="overflow-x-auto">
          <p className="text-center font-bold text-sm text-slate-700 mb-2">Timetable</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-300 px-2 py-1.5 bg-slate-100 w-20"></th>
                {DAYS.map(d => (
                  <th key={d} className="border border-slate-300 px-2 py-1.5 bg-slate-100 text-slate-700 font-semibold text-center text-[11px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <LessonRow label="Lesson 1" idx={0} />
              <LessonRow label="Lesson 2" idx={1} />
              <BreakRow label="Break" />
              <LessonRow label="Lesson 3" idx={2} />
              <LessonRow label="Lesson 4" idx={3} />
              <BreakRow label="Lunch" />
              <LessonRow label="Lesson 5" idx={4} />
              <LessonRow label="Lesson 6" idx={5} />
            </tbody>
          </table>
        </div>
      );
    }

    if (reportName === "Attendance Report (Detailed)") {
      const present = attendance.filter(a => a.status === "present").length;
      const absent = attendance.filter(a => a.status === "absent").length;
      const late = attendance.filter(a => a.status === "late").length;
      const pct = attendance.length ? Math.round((present / attendance.length) * 100) : (student.attendancePercent ?? 0);
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Present", val: present, cls: "text-green-700 bg-green-50 border-green-200" },
              { label: "Absent", val: absent, cls: "text-red-700 bg-red-50 border-red-200" },
              { label: "Late", val: late, cls: "text-amber-700 bg-amber-50 border-amber-200" },
              { label: "Attendance %", val: `${pct}%`, cls: "text-blue-700 bg-blue-50 border-blue-200" },
            ].map(({ label, val, cls }) => (
              <div key={label} className={`border rounded p-2 text-center ${cls}`}>
                <div className="text-lg font-bold">{val}</div>
                <div className="text-[10px] font-medium">{label}</div>
              </div>
            ))}
          </div>
          <table className="w-full text-xs border-collapse">
            {tblHead("Date", "Course", "Status", "Notes")}
            <tbody className="divide-y divide-slate-100">
              {attendance.length ? attendance.slice(0, 30).map(a => {
                const course = courses.find(c => c.id === a.courseId);
                return (
                  <tr key={a.date + a.courseId} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{new Date(a.date).toLocaleDateString("en-GB")}</td>
                    <td className="px-3 py-1.5 text-slate-700">{course ? `${course.code} — ${course.name}` : `Course ${a.courseId}`}</td>
                    <td className="px-3 py-1.5"><StatusBadge status={a.status.charAt(0).toUpperCase() + a.status.slice(1)} /></td>
                    <td className="px-3 py-1.5 text-slate-500">{a.notes ?? ""}</td>
                  </tr>
                );
              }) : empty(4)}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportName === "Achievement Report") {
      const done = targets.filter(t => t.completed).length;
      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{done} of {targets.length} targets achieved</p>
          <table className="w-full text-xs border-collapse">
            {tblHead("Target", "Description", "Due Date", "Status")}
            <tbody className="divide-y divide-slate-100">
              {targets.length ? targets.map(t => (
                <tr key={t.title} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-medium text-slate-800">{t.title}</td>
                  <td className="px-3 py-1.5 text-slate-600">{t.description ?? "—"}</td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB") : "—"}</td>
                  <td className="px-3 py-1.5"><StatusBadge status={t.completed ? "Achieved" : "Pending"} /></td>
                </tr>
              )) : empty(4)}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportName === "Disciplinary History") {
      return (
        <table className="w-full text-xs border-collapse">
          {tblHead("Date", "Incident", "Action Taken", "Recorded By")}
          <tbody className="divide-y divide-slate-100">
            {DISCIPLINARY.map(d => (
              <tr key={d.date} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{new Date(d.date).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-1.5 text-slate-700">{d.incident}</td>
                <td className="px-3 py-1.5 text-slate-600">{d.action}</td>
                <td className="px-3 py-1.5 text-slate-600">{d.staff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (reportName === "ILP Summary Report") {
      return (
        <table className="w-full text-xs border-collapse">
          {tblHead("Target / Objective", "Detail", "Status", "Created")}
          <tbody className="divide-y divide-slate-100">
            {ilps.length ? ilps.map(i => (
              <tr key={i.title + i.createdAt} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 font-medium text-slate-800">{i.title}</td>
                <td className="px-3 py-1.5 text-slate-600">{i.content ?? "—"}</td>
                <td className="px-3 py-1.5"><StatusBadge status={i.status} /></td>
                <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{new Date(i.createdAt).toLocaleDateString("en-GB")}</td>
              </tr>
            )) : empty(4)}
          </tbody>
        </table>
      );
    }

    if (reportName === "Enrichment Activity Report") {
      return (
        <table className="w-full text-xs border-collapse">
          {tblHead("Activity", "Start Date", "End Date", "Status")}
          <tbody className="divide-y divide-slate-100">
            {ENRICHMENT.map(e => (
              <tr key={e.activity} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 text-slate-700 font-medium">{e.activity}</td>
                <td className="px-3 py-1.5 text-slate-600">{new Date(e.start).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-1.5 text-slate-600">{new Date(e.end).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-1.5"><StatusBadge status={e.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (reportName === "Work Experience Log") {
      return (
        <table className="w-full text-xs border-collapse">
          {tblHead("Employer", "Start Date", "End Date", "Hours", "Supervisor")}
          <tbody className="divide-y divide-slate-100">
            {WORK_EXP.map(w => (
              <tr key={w.employer} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 text-slate-700 font-medium">{w.employer}</td>
                <td className="px-3 py-1.5 text-slate-600">{new Date(w.start).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-1.5 text-slate-600">{new Date(w.end).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-1.5 text-slate-600 text-center">{w.hours}</td>
                <td className="px-3 py-1.5 text-slate-600">{w.supervisor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  }

  return (
    <Dialog open={!!reportName} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        {/* Header */}
        <div className="bg-teal-800 text-white px-5 py-3 flex items-start justify-between">
          <div>
            <DialogHeader>
              <DialogTitle className="text-white text-base font-bold">{reportName}</DialogTitle>
            </DialogHeader>
            <p className="text-teal-200 text-xs mt-0.5">
              {name} &nbsp;|&nbsp; Ref: {student.personCode ?? "—"} &nbsp;|&nbsp; Year: {student.yearGroup ?? "—"} &nbsp;|&nbsp; Generated: {today}
            </p>
          </div>
          <button onClick={handlePrint} className="ml-4 flex items-center gap-1.5 bg-white text-teal-800 text-xs font-semibold px-3 py-1.5 rounded hover:bg-teal-50 shrink-0">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-36 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-900">{value || "—"}</span>
    </div>
  );
}

function EmptySection({ title, columns }: { title: string; columns: string[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded">
      <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map(c => (
              <th key={c} className="text-left font-semibold text-slate-600 px-5 py-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-400">
              No records on file. Add your data to populate this section.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const LEFT_LINKS = [
  "Personal Details",
  "Emergency Contacts",
  "Medical / Disability",
  "Prior Attainment",
  "Qualifications",
  "Exam Timetable",
  "Finance & Funding",
  "Documents / Uploads",
  "Audit Trail",
  "Progressions",
];

const CENTER_TABS = [
  "Summary", "Address", "Enrolments", "Attendance", "Performance", "ILP", "Pastoral", "Evidence", "Communication",
];

const REPORTS = [
  "Learner Timetable",
  "Attendance Report (Detailed)",
  "Achievement Report",
  "Disciplinary History",
  "ILP Summary Report",
  "Enrichment Activity Report",
  "Work Experience Log",
];

export default function StudentDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const [activeLink, setActiveLink] = useState("Personal Details");
  const [activeTab, setActiveTab] = useState("Summary");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [reportOpen, setReportOpen] = useState<string | null>(null);

  const { data: student, isLoading: isStudentLoading } = useGetStudent(id, { query: { enabled: !!id } as any });
  const { data: attendance, isLoading: isAttendanceLoading } = useListAttendanceRecords({ studentId: id }, { query: { enabled: !!id } as any });
  const { data: targets, isLoading: isTargetsLoading } = useListTargets({ studentId: id }, { query: { enabled: !!id } as any });
  const { data: ilps, isLoading: isIlpsLoading } = useListIlps({ studentId: id }, { query: { enabled: !!id } as any });
  const { data: allCourses } = useListCourses({ query: {} as any });

  if (isStudentLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!student) {
    return <div className="p-12 text-center text-muted-foreground">Learner not found.</div>;
  }

  const fullName = [student.forename, student.middleNames, student.surname].filter(Boolean).join(" ");
  const dob = student.dateOfBirth || "—";
  const age = student.dateOfBirth
    ? Math.floor((Date.now() - new Date(student.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  function handleSaveNote() {
    if (noteText.trim()) { setNoteSaved(true); setNoteText(""); setTimeout(() => { setNoteSaved(false); setShowNoteForm(false); }, 2000); }
  }
  function handleSendMessage() {
    if (messageText.trim()) { setMessageSent(true); setMessageText(""); setTimeout(() => { setMessageSent(false); setShowMessageForm(false); }, 2000); }
  }

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      {/* ── Left Links Pane ── */}
      <div className="w-44 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Learner Links</p>
        </div>
        {LEFT_LINKS.map(item => (
          <button
            key={item}
            onClick={() => {
                if (item === "Progressions") { setLocation(`/students/${id}/progressions`); return; }
                setActiveLink(item);
                if (item === "Personal Details") setActiveTab("Summary");
              }}
            className={`w-full text-left text-xs px-4 py-2 border-b border-slate-100 transition-colors ${
              activeLink === item ? "bg-teal-700 text-white font-semibold" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* ── Center Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Header bar */}
        <div className="bg-white border-b border-slate-200 px-5 py-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-800">{fullName}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                DOB: {dob}{age ? ` (Age ${age})` : ""} &nbsp;|&nbsp; Ref: {student.personCode} &nbsp;|&nbsp; Status: {student.confirmedLearner ? "Confirmed" : "Unconfirmed"}
              </p>
            </div>
            <div className="flex gap-2 shrink-0 ml-4 flex-wrap justify-end">
              <button
                onClick={() => { setShowNoteForm(v => !v); setShowMessageForm(false); }}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <PlusCircle className="w-3 h-3" /> Add Note
              </button>
              <button
                onClick={() => { setShowMessageForm(v => !v); setShowNoteForm(false); }}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Mail className="w-3 h-3" /> Send Message
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Printer className="w-3 h-3" /> Print Profile
              </button>
            </div>
          </div>

          {student.atRisk && (
            <div className="mt-2 inline-flex items-center gap-2 bg-red-600 text-white text-xs font-semibold px-3 py-1 rounded">
              <AlertTriangle className="w-3 h-3" /> At Risk — Requires Additional Support
            </div>
          )}

          {/* Add Note inline form */}
          {showNoteForm && (
            <div className="mt-3 border border-slate-200 rounded bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Add a note for {student.forename}</p>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={3}
                placeholder="Type note here…"
                className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-teal-400"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveNote} className="flex items-center gap-1 text-xs bg-teal-700 text-white rounded px-3 py-1 hover:bg-teal-800">
                  <Check className="w-3 h-3" /> {noteSaved ? "Saved!" : "Save Note"}
                </button>
                <button onClick={() => setShowNoteForm(false)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Send Message inline form */}
          {showMessageForm && (
            <div className="mt-3 border border-slate-200 rounded bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Send message to {student.forename}</p>
              <input
                value={student.forename + " " + student.surname}
                readOnly
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-400"
              />
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={3}
                placeholder="Type your message…"
                className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-teal-400"
              />
              <div className="flex gap-2">
                <button onClick={handleSendMessage} className="flex items-center gap-1 text-xs bg-teal-700 text-white rounded px-3 py-1 hover:bg-teal-800">
                  <Mail className="w-3 h-3" /> {messageSent ? "Sent!" : "Send"}
                </button>
                <button onClick={() => setShowMessageForm(false)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Tab bar — only when Personal Details is active */}
          {activeLink === "Personal Details" && (
            <div className="flex gap-0 mt-3 -mb-3 flex-wrap">
              {CENTER_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs px-3 py-1.5 border-t border-l border-r rounded-t transition-colors ${
                    activeTab === tab
                      ? "bg-white border-slate-300 font-semibold text-teal-700 -mb-px z-10 relative"
                      : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Tab content — Personal Details ── */}
        <div className="flex-1 p-5">
          {activeLink === "Personal Details" && (
            <>
              {activeTab === "Summary" && (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Learner Details</p>
                    </div>
                    <div className="px-5 py-4 flex gap-6">
                      <div className="w-24 h-28 shrink-0 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-slate-300">
                        <UserCircle2 className="w-16 h-16" />
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-x-10">
                        <div className="space-y-1">
                          <InfoRow label="Full Name" value={fullName} />
                          <InfoRow label="Gender" value={student.gender} />
                          <InfoRow label="Date of Birth" value={dob} />
                          <InfoRow label="Age" value={age?.toString()} />
                          <InfoRow label="Ethnicity" value="—" />
                          <InfoRow label="ULN" value={`ULN${String(student.id).padStart(10, "0")}`} />
                        </div>
                        <div className="space-y-1">
                          <InfoRow label="Student Status" value={student.confirmedLearner ? "Current" : "Unconfirmed"} />
                          <InfoRow label="Student Type" value="Standard" />
                          <InfoRow label="Year / Tutor Group" value={student.yearGroup} />
                          <InfoRow label="Home Telephone" value="—" />
                          <InfoRow label="Mobile Telephone" value="—" />
                          <InfoRow label="Email Address" value="—" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Attendance</p>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-4 gap-6">
                      <div>
                        <p className="text-xs text-slate-500">Current Year Attendance</p>
                        <p className={`text-2xl font-bold mt-1 ${student.attendancePercent < 90 ? "text-red-600" : "text-emerald-600"}`}>{student.attendancePercent}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Cumulative Attendance</p>
                        <p className={`text-2xl font-bold mt-1 ${student.attendancePercent < 90 ? "text-red-600" : "text-emerald-600"}`}>{Math.round(student.attendancePercent * 0.97)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Punctuality</p>
                        <p className={`text-2xl font-bold mt-1 ${student.punctualityPercent < 95 ? "text-amber-500" : "text-emerald-600"}`}>{student.punctualityPercent}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Confirmed Learner</p>
                        <p className="text-sm font-semibold mt-2 text-slate-800">{student.confirmedLearner ? "Yes" : "No"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Course Summary</p>
                    </div>
                    {isAttendanceLoading ? <div className="px-5 py-4"><Skeleton className="h-16 w-full" /></div> : attendance?.length ? (
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-100"><th className="text-left font-semibold text-slate-600 px-5 py-2">Course Name</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Date</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Status</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {attendance.slice(0, 5).map(r => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="px-5 py-1.5 text-sky-700">{r.courseName}</td>
                              <td className="px-3 py-1.5 text-slate-500">{r.date}</td>
                              <td className="px-3 py-1.5"><span className={`font-semibold capitalize ${r.status === "present" ? "text-emerald-600" : r.status === "absent" ? "text-red-600" : r.status === "late" ? "text-amber-600" : "text-blue-600"}`}>{r.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <div className="px-5 py-4 text-xs text-slate-400">No course records.</div>}
                  </div>
                </div>
              )}

              {activeTab === "Address" && (
                <div className="bg-white border border-slate-200 rounded">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Address Details</p></div>
                  <div className="px-5 py-4 grid grid-cols-2 gap-x-10 gap-y-1">
                    <InfoRow label="Address Line 1" value="—" />
                    <InfoRow label="Address Line 2" value="—" />
                    <InfoRow label="Town / City" value="—" />
                    <InfoRow label="County" value="—" />
                    <InfoRow label="Post Code" value={student.postCode} />
                    <InfoRow label="Country" value="England" />
                    <InfoRow label="Home Telephone" value="—" />
                    <InfoRow label="Mobile" value="—" />
                    <InfoRow label="Email" value="—" />
                  </div>
                </div>
              )}

              {activeTab === "Enrolments" && <EmptySection title="Enrolments" columns={["Course Code", "Course Name", "Start Date", "End Date", "Status", "Qualification"]} />}

              {activeTab === "Attendance" && (
                <div className="bg-white border border-slate-200 rounded">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Attendance History</p></div>
                  {isAttendanceLoading ? <div className="px-5 py-4"><Skeleton className="h-32 w-full" /></div> : attendance?.length ? (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-slate-100"><th className="text-left font-semibold text-slate-600 px-5 py-2">Course</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Date</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Status</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Notes</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {attendance.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="px-5 py-1.5 text-sky-700">{r.courseName}</td>
                            <td className="px-3 py-1.5 text-slate-500">{r.date}</td>
                            <td className="px-3 py-1.5"><span className={`font-semibold capitalize ${r.status === "present" ? "text-emerald-600" : r.status === "absent" ? "text-red-600" : r.status === "late" ? "text-amber-600" : "text-blue-600"}`}>{r.status}</span></td>
                            <td className="px-3 py-1.5 text-slate-400">—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="px-5 py-4 text-xs text-slate-400">No attendance records.</div>}
                </div>
              )}

              {activeTab === "Performance" && (
                <div className="bg-white border border-slate-200 rounded">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">SMART Targets</p></div>
                  {isTargetsLoading ? <div className="px-5 py-4"><Skeleton className="h-24 w-full" /></div> : targets?.length ? (
                    <div className="px-5 py-4 space-y-3">
                      {targets.map(t => (
                        <div key={t.id} className="border border-slate-200 rounded p-3">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-xs text-slate-800">{t.title}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${t.completed ? "bg-emerald-100 text-emerald-700" : t.overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                              {t.completed ? "Completed" : t.overdue ? "Overdue" : "Active"}
                            </span>
                          </div>
                          {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                          {t.dueDate && <p className="text-xs text-slate-400 mt-1">Due: {t.dueDate}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <div className="px-5 py-4 text-xs text-slate-400">No SMART targets set.</div>}
                </div>
              )}

              {activeTab === "ILP" && (
                <div className="bg-white border border-slate-200 rounded">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Individual Learning Plans</p></div>
                  {isIlpsLoading ? <div className="px-5 py-4"><Skeleton className="h-24 w-full" /></div> : ilps?.length ? (
                    <div className="px-5 py-4 space-y-3">
                      {ilps.map(i => (
                        <div key={i.id} className="border border-slate-200 rounded p-3">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-xs text-slate-800">{i.title}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${i.status === "active" ? "bg-teal-100 text-teal-700" : i.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{i.status}</span>
                          </div>
                          {i.content && <p className="text-xs text-slate-500 mt-1 line-clamp-3">{i.content}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <div className="px-5 py-4 text-xs text-slate-400">No ILPs on file.</div>}
                </div>
              )}

              {activeTab === "Pastoral" && <EmptySection title="Pastoral Notes" columns={["Date", "Type", "Staff Member", "Summary", "Follow-up Required"]} />}
              {activeTab === "Evidence" && <EmptySection title="Evidence Portfolio" columns={["Title", "Type", "Date Added", "Course", "Uploaded By"]} />}
              {activeTab === "Communication" && <EmptySection title="Communication Log" columns={["Date", "Method", "Direction", "Summary", "Staff"]} />}
            </>
          )}

          {activeLink === "Emergency Contacts" && (
            <EmptySection title="Emergency Contacts" columns={["Name", "Relationship", "Home Telephone", "Mobile", "Priority", "Notes"]} />
          )}

          {activeLink === "Medical / Disability" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Medical &amp; Disability Information</p></div>
              <div className="px-5 py-4 grid grid-cols-2 gap-x-10 gap-y-1">
                <InfoRow label="Medical Conditions" value="—" />
                <InfoRow label="Disabilities" value="—" />
                <InfoRow label="Learning Difficulties" value="—" />
                <InfoRow label="Special Requirements" value="—" />
                <InfoRow label="Emergency Medication" value="—" />
                <InfoRow label="Doctor / GP" value="—" />
                <InfoRow label="Doctor Telephone" value="—" />
                <InfoRow label="Additional Notes" value="—" />
              </div>
            </div>
          )}

          {activeLink === "Prior Attainment" && (
            <EmptySection title="Prior Attainment" columns={["Subject", "Qualification", "Awarding Body", "Grade", "Level", "Year Achieved"]} />
          )}

          {activeLink === "Qualifications" && (
            <EmptySection title="Qualifications" columns={["Qualification Name", "Awarding Body", "Level", "Start Date", "End Date", "Status", "Grade"]} />
          )}

          {activeLink === "Exam Timetable" && (
            <EmptySection title="Exam Timetable" columns={["Exam Name", "Date", "Start Time", "Duration", "Room", "Board / Occurrence"]} />
          )}

          {activeLink === "Finance & Funding" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Finance &amp; Funding</p></div>
              <div className="px-5 py-4 grid grid-cols-2 gap-x-10 gap-y-1">
                <InfoRow label="Funding Type" value="—" />
                <InfoRow label="Funding Body" value="—" />
                <InfoRow label="Funding Amount" value="—" />
                <InfoRow label="Funding Status" value="—" />
                <InfoRow label="Bursary" value="—" />
                <InfoRow label="Free Meals" value="—" />
                <InfoRow label="Travel" value="—" />
                <InfoRow label="Notes" value="—" />
              </div>
            </div>
          )}

          {activeLink === "Documents / Uploads" && (
            <EmptySection title="Documents &amp; Uploads" columns={["Document Name", "Type", "Date Uploaded", "Uploaded By", "Notes"]} />
          )}

          {activeLink === "Audit Trail" && (
            <EmptySection title="Audit Trail" columns={["Date / Time", "User", "Action", "Section", "Details"]} />
          )}
        </div>
      </div>

      {/* ── Right Reports Pane ── */}
      <div className="w-44 shrink-0 bg-white border-l border-slate-200 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reports</p>
        </div>
        {REPORTS.map(r => (
          <button
            key={r}
            onClick={() => setReportOpen(r)}
            className="w-full text-left text-xs px-4 py-2 border-b border-slate-100 text-sky-700 hover:bg-sky-50 flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3 h-3 shrink-0 text-sky-500" />{r}
          </button>
        ))}
      </div>

      <StudentReportDialog
        reportName={reportOpen}
        student={student}
        attendance={attendance ?? []}
        targets={targets ?? []}
        ilps={ilps ?? []}
        courses={allCourses ?? []}
        onClose={() => setReportOpen(null)}
      />
    </div>
  );
}
