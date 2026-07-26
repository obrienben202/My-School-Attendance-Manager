import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetCourse, useListAttendanceRecords, useListAssessments } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, FileText, Download, Users, BookOpen, Clock, Layers, ClipboardList, UserCheck, PenTool, TrendingUp, Printer, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-40 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-900">{value ?? "—"}</span>
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded mb-3 bg-white">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-left rounded-t border-b border-slate-200">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

const COURSE_LINKS = [
  { label: "Enrolled Learners", icon: Users },
  { label: "Course Units / Modules", icon: Layers },
  { label: "Timetable Slots", icon: Clock },
  { label: "Learning Resources", icon: BookOpen },
  { label: "Assessment Plan", icon: ClipboardList },
  { label: "Staff Assignments", icon: UserCheck },
  { label: "Progressions", icon: TrendingUp },
];

const COURSE_REPORTS = [
  "Course Register (Master)",
  "Attendance Analysis by Student",
  "Course Completion Report",
  "Retention Statistics",
  "Grade Distribution Report",
];

const FACULTIES = ["Business & Administration", "Mathematics", "English & Media", "Science", "Arts & Design", "Computing", "PE & Health", "Modern Languages"];
const LEVELS = ["Level 1", "Level 2", "Level 3", "GCSE", "A Level", "BTEC", "Entry Level"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const START_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

// ── Report / Print helpers ────────────────────────────────────────────────────

type CourseType = {
  id: number; code: string; name: string; room?: string | null;
  staffName?: string | null; enrolledCount: number;
  level?: string | null; faculty?: string | null;
  academicYear?: string | null; courseHours?: number | null; status?: string | null;
};
type AttType = { studentName?: string | null; date: string; status: string; studentId?: number };
type StudentType = { id: number; forename: string; surname: string; personCode?: string | null; gender?: string | null; yearGroup?: string | null; attendancePercent: number };
type AssessType = { code: string; description: string; type: string; dueDate?: string | null; gradingScheme: string; minPassMark?: string | null; mandatory: number | boolean };

function openPrintWindow(title: string, html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#222;}
  h1{font-size:17px;margin-bottom:4px;}
  .meta{font-size:11px;color:#555;margin-bottom:16px;border-bottom:1px solid #ccc;padding-bottom:8px;}
  .section-title{font-size:13px;font-weight:bold;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px;}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;}
  th{background:#1e3a5f;color:#fff;text-align:left;padding:6px 8px;font-size:11px;}
  td{border-bottom:1px solid #e0e0e0;padding:5px 8px;font-size:11px;}
  tr:nth-child(even) td{background:#f8f8f8;}
  .g{color:#166534;font-weight:bold;} .r{color:#991b1b;font-weight:bold;} .a{color:#92400e;font-weight:bold;}
  .tbl2 td,.tbl2 th{border:1px solid #bbb;padding:5px 8px;}
  @media print{body{margin:12px;}}
</style></head><body onload="window.print()">${html}</body></html>`);
  w.document.close();
}

function courseHeader(course: CourseType, level: string, faculty: string, extra = "") {
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  return `<h1>${course.name}</h1>
<div class="meta">Code: ${course.code} &nbsp;|&nbsp; ${level} &nbsp;|&nbsp; ${faculty} &nbsp;|&nbsp; Status: Active &nbsp;|&nbsp; Staff: ${course.staffName ?? "—"} &nbsp;|&nbsp; Generated: ${today}${extra}</div>`;
}

function printCurriculumWindow(
  course: CourseType, level: string, faculty: string,
  dayOfWeek: string, startTime: string, endTime: string,
  assessments: AssessType[],
  presentCount: number, absentCount: number, lateCount: number,
) {
  const hdr = courseHeader(course, level, faculty);
  const placeRows = [
    ["Total Places", course.enrolledCount], ["Active Places", Math.max(0, course.enrolledCount - absentCount)],
    ["Non Starter Places", absentCount], ["Finished Places", lateCount],
    ["Remaining Places", Math.max(0, course.enrolledCount - presentCount)], ["Waiting", 0],
  ].map(([l, v]) => `<tr><td style="font-weight:500">${l}</td><td>${v}</td></tr>`).join("");

  const asmRows = assessments.length
    ? assessments.map(a => `<tr><td>${a.code}</td><td>${a.description}</td><td>${a.type}</td><td>${a.dueDate ?? "—"}</td><td>${a.gradingScheme}</td><td>${a.mandatory ? "Yes" : "No"}</td></tr>`).join("")
    : `<tr><td colspan="6">No assessments on record.</td></tr>`;

  const html = `${hdr}
<div class="section-title">Course Details</div>
<table class="tbl2" style="width:auto;min-width:400px">
  <tbody>
    <tr><td style="font-weight:500">Course Code</td><td>${course.code}</td><td style="font-weight:500">Course Leader</td><td>${course.staffName ?? "—"}</td></tr>
    <tr><td style="font-weight:500">Level</td><td>${level}</td><td style="font-weight:500">Academic Year</td><td>${(course as CourseType).academicYear ?? "2024/25"}</td></tr>
    <tr><td style="font-weight:500">Faculty</td><td>${faculty}</td><td style="font-weight:500">Course Hours</td><td>${(course as CourseType).courseHours ?? 180}</td></tr>
    <tr><td style="font-weight:500">Room</td><td>${course.room ?? "—"}</td><td style="font-weight:500">Status</td><td>${(course as CourseType).status ?? "Active"}</td></tr>
  </tbody>
</table>
<div class="section-title">Timetable</div>
<table class="tbl2" style="width:auto">
  <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Room</th><th>Week Pattern</th></tr></thead>
  <tbody><tr><td>${dayOfWeek}</td><td>${startTime}</td><td>${endTime}</td><td>${course.room ?? "—"}</td><td>1–49, 51–52</td></tr></tbody>
</table>
<div class="section-title">Place Totals</div>
<table class="tbl2" style="width:auto"><tbody>${placeRows}</tbody></table>
<div class="section-title">Assessment Plan</div>
<table>
  <thead><tr><th>Code</th><th>Description</th><th>Type</th><th>Due Date</th><th>Grading Scheme</th><th>Mandatory</th></tr></thead>
  <tbody>${asmRows}</tbody>
</table>
<div class="section-title">Units / Modules</div>
<p style="color:#777;font-style:italic">No units or modules on record.</p>
<div class="section-title">Learning Resources</div>
<p style="color:#777;font-style:italic">No learning resources linked.</p>`;

  openPrintWindow(`Curriculum — ${course.name}`, html);
}

function buildCourseReportHtml(
  reportName: string,
  course: CourseType, level: string, faculty: string,
  attendance: AttType[], students: StudentType[],
  assessments: AssessType[],
): string {
  const hdr = courseHeader(course, level, faculty);

  if (reportName === "Course Register (Master)") {
    const rows = students.map(s => `<tr>
      <td>${s.forename} ${s.surname}</td>
      <td>${s.personCode ?? "—"}</td>
      <td>${s.gender ?? "—"}</td>
      <td>${s.yearGroup ?? "—"}</td>
      <td class="${s.attendancePercent < 90 ? "r" : "g"}">${s.attendancePercent}%</td>
    </tr>`).join("");
    return `${hdr}<div class="section-title">Enrolled Learners (${students.length})</div>
<table><thead><tr><th>Name</th><th>Ref</th><th>Gender</th><th>Year</th><th>Attendance %</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">No learners enrolled.</td></tr>'}</tbody></table>`;
  }

  if (reportName === "Attendance Analysis by Student") {
    const byStudent: Record<number, { name: string; present: number; absent: number; late: number }> = {};
    attendance.forEach(a => {
      const sid = a.studentId ?? 0;
      if (!byStudent[sid]) byStudent[sid] = { name: a.studentName ?? `Student ${sid}`, present: 0, absent: 0, late: 0 };
      if (a.status === "present") byStudent[sid].present++;
      else if (a.status === "absent") byStudent[sid].absent++;
      else byStudent[sid].late++;
    });
    const rows = Object.values(byStudent).map(s => {
      const total = s.present + s.absent + s.late;
      const pct = total ? Math.round((s.present / total) * 100) : 0;
      return `<tr><td>${s.name}</td><td class="g">${s.present}</td><td class="r">${s.absent}</td><td class="a">${s.late}</td><td>${total}</td><td class="${pct < 90 ? "r" : "g"}">${pct}%</td></tr>`;
    }).join("");
    return `${hdr}<div class="section-title">Attendance by Student</div>
<table><thead><tr><th>Student</th><th>Present</th><th>Absent</th><th>Late</th><th>Total</th><th>Rate</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">No attendance records.</td></tr>'}</tbody></table>`;
  }

  if (reportName === "Course Completion Report") {
    const rows = students.map(s => {
      const status = s.attendancePercent >= 80 ? "On Track" : s.attendancePercent >= 60 ? "At Risk" : "Withdrawn";
      const cls = status === "On Track" ? "g" : status === "At Risk" ? "a" : "r";
      return `<tr><td>${s.forename} ${s.surname}</td><td>${s.personCode ?? "—"}</td><td class="${cls}">${status}</td><td class="${s.attendancePercent < 90 ? "r" : "g"}">${s.attendancePercent}%</td></tr>`;
    }).join("");
    return `${hdr}<div class="section-title">Completion Status</div>
<table><thead><tr><th>Name</th><th>Ref</th><th>Status</th><th>Attendance</th></tr></thead>
<tbody>${rows || '<tr><td colspan="4">No data available.</td></tr>'}</tbody></table>`;
  }

  if (reportName === "Retention Statistics") {
    const onTrack = students.filter(s => s.attendancePercent >= 80).length;
    const atRisk = students.filter(s => s.attendancePercent >= 60 && s.attendancePercent < 80).length;
    const withdrawn = students.filter(s => s.attendancePercent < 60).length;
    const retRate = students.length ? Math.round((onTrack / students.length) * 100) : 0;
    return `${hdr}<div class="section-title">Retention Summary</div>
<table class="tbl2" style="width:auto">
  <tbody>
    <tr><td style="font-weight:500">Total Enrolled</td><td>${students.length}</td></tr>
    <tr><td style="font-weight:500">On Track</td><td class="g">${onTrack}</td></tr>
    <tr><td style="font-weight:500">At Risk</td><td class="a">${atRisk}</td></tr>
    <tr><td style="font-weight:500">Withdrawn</td><td class="r">${withdrawn}</td></tr>
    <tr><td style="font-weight:500">Retention Rate</td><td class="${retRate >= 80 ? "g" : "r"}">${retRate}%</td></tr>
  </tbody>
</table>`;
  }

  if (reportName === "Grade Distribution Report") {
    const grades: Record<string, number> = { Distinction: 0, Merit: 0, Pass: 0, "Near Miss": 0, Fail: 0 };
    students.forEach(s => {
      if (s.attendancePercent >= 90) grades["Distinction"]++;
      else if (s.attendancePercent >= 80) grades["Merit"]++;
      else if (s.attendancePercent >= 70) grades["Pass"]++;
      else if (s.attendancePercent >= 60) grades["Near Miss"]++;
      else grades["Fail"]++;
    });
    const rows = Object.entries(grades).map(([g, n]) => {
      const pct = students.length ? Math.round((n / students.length) * 100) : 0;
      return `<tr><td>${g}</td><td>${n}</td><td>${pct}%</td></tr>`;
    }).join("");
    return `${hdr}<div class="section-title">Grade Distribution (based on attendance bands)</div>
<table><thead><tr><th>Grade</th><th>Count</th><th>%</th></tr></thead>
<tbody>${rows}</tbody></table>
${assessments.length ? `<div class="section-title">Assessments</div>
<table><thead><tr><th>Code</th><th>Description</th><th>Type</th><th>Due Date</th></tr></thead>
<tbody>${assessments.map(a => `<tr><td>${a.code}</td><td>${a.description}</td><td>${a.type}</td><td>${a.dueDate ?? "—"}</td></tr>`).join("")}</tbody></table>` : ""}`;
  }

  return `${hdr}<p>Report content not available.</p>`;
}

// ── In-app status badge ───────────────────────────────────────────────────────
function CStatusBadge({ label }: { label: string }) {
  const cls =
    label === "On Track" || label === "Active" ? "text-green-700 bg-green-50 border-green-200" :
    label === "At Risk" ? "text-amber-700 bg-amber-50 border-amber-200" :
    label === "Withdrawn" || label === "Fail" ? "text-red-700 bg-red-50 border-red-200" :
    "text-slate-600 bg-slate-50 border-slate-200";
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}

function CourseReportDialog({
  reportName, course, level, faculty,
  attendance, students, assessments, onClose,
}: {
  reportName: string | null;
  course: CourseType; level: string; faculty: string;
  attendance: AttType[]; students: StudentType[];
  assessments: AssessType[];
  onClose: () => void;
}) {
  if (!reportName) return null;

  function handlePrint() {
    const html = buildCourseReportHtml(reportName!, course, level, faculty, attendance, students, assessments);
    openPrintWindow(reportName!, html);
  }

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

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

  function renderContent() {
    if (reportName === "Course Register (Master)") {
      return (
        <table className="w-full text-xs border-collapse">
          {tblHead("Name", "Ref", "Gender", "Year Group", "Attendance %")}
          <tbody className="divide-y divide-slate-100">
            {students.length ? students.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 text-slate-800 font-medium">{s.forename} {s.surname}</td>
                <td className="px-3 py-1.5 text-slate-500">{s.personCode ?? "—"}</td>
                <td className="px-3 py-1.5 text-slate-600">{s.gender ?? "—"}</td>
                <td className="px-3 py-1.5 text-slate-600">{s.yearGroup ?? "—"}</td>
                <td className="px-3 py-1.5 font-semibold text-right pr-6">
                  <span className={s.attendancePercent < 90 ? "text-red-600" : "text-green-700"}>{s.attendancePercent}%</span>
                </td>
              </tr>
            )) : empty(5)}
          </tbody>
        </table>
      );
    }

    if (reportName === "Attendance Analysis by Student") {
      const byStudent: Record<number, { name: string; present: number; absent: number; late: number }> = {};
      attendance.forEach(a => {
        const sid = a.studentId ?? 0;
        if (!byStudent[sid]) byStudent[sid] = { name: a.studentName ?? `Student ${sid}`, present: 0, absent: 0, late: 0 };
        if (a.status === "present") byStudent[sid].present++;
        else if (a.status === "absent") byStudent[sid].absent++;
        else byStudent[sid].late++;
      });
      return (
        <table className="w-full text-xs border-collapse">
          {tblHead("Student", "Present", "Absent", "Late", "Total", "Rate")}
          <tbody className="divide-y divide-slate-100">
            {Object.values(byStudent).length ? Object.values(byStudent).map((s, i) => {
              const total = s.present + s.absent + s.late;
              const pct = total ? Math.round((s.present / total) * 100) : 0;
              return (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-slate-800">{s.name}</td>
                  <td className="px-3 py-1.5 text-center text-green-700 font-semibold">{s.present}</td>
                  <td className="px-3 py-1.5 text-center text-red-600 font-semibold">{s.absent}</td>
                  <td className="px-3 py-1.5 text-center text-amber-700 font-semibold">{s.late}</td>
                  <td className="px-3 py-1.5 text-center text-slate-600">{total}</td>
                  <td className="px-3 py-1.5 text-center font-bold">
                    <span className={pct < 90 ? "text-red-600" : "text-green-700"}>{pct}%</span>
                  </td>
                </tr>
              );
            }) : empty(6)}
          </tbody>
        </table>
      );
    }

    if (reportName === "Course Completion Report") {
      return (
        <table className="w-full text-xs border-collapse">
          {tblHead("Name", "Ref", "Completion Status", "Attendance")}
          <tbody className="divide-y divide-slate-100">
            {students.length ? students.map(s => {
              const status = s.attendancePercent >= 80 ? "On Track" : s.attendancePercent >= 60 ? "At Risk" : "Withdrawn";
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-slate-800 font-medium">{s.forename} {s.surname}</td>
                  <td className="px-3 py-1.5 text-slate-500">{s.personCode ?? "—"}</td>
                  <td className="px-3 py-1.5"><CStatusBadge label={status} /></td>
                  <td className="px-3 py-1.5 font-semibold">
                    <span className={s.attendancePercent < 90 ? "text-red-600" : "text-green-700"}>{s.attendancePercent}%</span>
                  </td>
                </tr>
              );
            }) : empty(4)}
          </tbody>
        </table>
      );
    }

    if (reportName === "Retention Statistics") {
      const onTrack = students.filter(s => s.attendancePercent >= 80).length;
      const atRisk = students.filter(s => s.attendancePercent >= 60 && s.attendancePercent < 80).length;
      const withdrawn = students.filter(s => s.attendancePercent < 60).length;
      const retRate = students.length ? Math.round((onTrack / students.length) * 100) : 0;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "Enrolled", val: students.length, cls: "text-blue-700 bg-blue-50 border-blue-200" },
              { label: "On Track", val: onTrack, cls: "text-green-700 bg-green-50 border-green-200" },
              { label: "At Risk", val: atRisk, cls: "text-amber-700 bg-amber-50 border-amber-200" },
              { label: "Withdrawn", val: withdrawn, cls: "text-red-700 bg-red-50 border-red-200" },
              { label: "Retention Rate", val: `${retRate}%`, cls: retRate >= 80 ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200" },
            ].map(({ label, val, cls }) => (
              <div key={label} className={`border rounded p-2 text-center ${cls}`}>
                <div className="text-xl font-bold">{val}</div>
                <div className="text-[10px] font-medium mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <table className="w-full text-xs border-collapse">
            {tblHead("Name", "Ref", "Status", "Attendance %")}
            <tbody className="divide-y divide-slate-100">
              {students.length ? students.map(s => {
                const status = s.attendancePercent >= 80 ? "On Track" : s.attendancePercent >= 60 ? "At Risk" : "Withdrawn";
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-slate-800">{s.forename} {s.surname}</td>
                    <td className="px-3 py-1.5 text-slate-500">{s.personCode ?? "—"}</td>
                    <td className="px-3 py-1.5"><CStatusBadge label={status} /></td>
                    <td className="px-3 py-1.5 font-semibold">
                      <span className={s.attendancePercent < 90 ? "text-red-600" : "text-green-700"}>{s.attendancePercent}%</span>
                    </td>
                  </tr>
                );
              }) : empty(4)}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportName === "Grade Distribution Report") {
      const bands = [
        { label: "Distinction", min: 90, cls: "text-green-700 bg-green-50 border-green-200" },
        { label: "Merit", min: 80, cls: "text-teal-700 bg-teal-50 border-teal-200" },
        { label: "Pass", min: 70, cls: "text-blue-700 bg-blue-50 border-blue-200" },
        { label: "Near Miss", min: 60, cls: "text-amber-700 bg-amber-50 border-amber-200" },
        { label: "Fail", min: 0, cls: "text-red-700 bg-red-50 border-red-200" },
      ];
      const counts = bands.map((b, i) => ({
        ...b,
        count: students.filter(s => s.attendancePercent >= b.min && (i === 0 || s.attendancePercent < bands[i - 1].min)).length,
      }));
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {counts.map(({ label, count, cls }) => (
              <div key={label} className={`border rounded p-2 text-center ${cls}`}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-[10px] font-medium mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <table className="w-full text-xs border-collapse">
            {tblHead("Grade", "Count", "%")}
            <tbody className="divide-y divide-slate-100">
              {counts.map(({ label, count, cls }) => {
                const pct = students.length ? Math.round((count / students.length) * 100) : 0;
                return (
                  <tr key={label} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{label}</td>
                    <td className="px-3 py-2 text-center font-bold"><span className={cls.split(" ")[0]}>{count}</span></td>
                    <td className="px-3 py-2 text-center text-slate-600">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  }

  return (
    <Dialog open={!!reportName} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <div className="bg-teal-800 text-white px-5 py-3 flex items-start justify-between">
          <div>
            <DialogHeader>
              <DialogTitle className="text-white text-base font-bold">{reportName}</DialogTitle>
            </DialogHeader>
            <p className="text-teal-200 text-xs mt-0.5">
              {course.name} &nbsp;|&nbsp; {course.code} &nbsp;|&nbsp; {level} &nbsp;|&nbsp; {faculty} &nbsp;|&nbsp; Generated: {today}
            </p>
          </div>
          <button onClick={handlePrint} className="ml-4 flex items-center gap-1.5 bg-white text-teal-800 text-xs font-semibold px-3 py-1.5 rounded hover:bg-teal-50 shrink-0">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type TimetableSlot = {
  id: number;
  courseId: number;
  day: string | null;
  startTime: string;
  endTime: string;
  room: string | null;
  weekPattern: string;
};

type SlotFormState = {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  weekPattern: string;
};

const EMPTY_SLOT: SlotFormState = { day: "Monday", startTime: "09:00", endTime: "10:00", room: "", weekPattern: "Every week" };
const WEEK_PATTERNS = ["Every week", "Week A only", "Week B only"];

export default function CourseDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const id = parseInt(params.id || "0", 10);
  const [activeLink, setActiveLink] = useState("Enrolled Learners");
  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const role = useRole();
  const canEditTimetable = role === "admin" || role === "hod";
  const qc = useQueryClient();

  // Slot form state
  const [addingSlot, setAddingSlot] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [slotForm, setSlotForm] = useState<SlotFormState>(EMPTY_SLOT);

  const { data: course, isLoading } = useGetCourse(id, { query: { enabled: !!id } as any });
  const { data: attendance } = useListAttendanceRecords({ courseId: id }, { query: { enabled: !!id } as any });
  const { data: enrolledStudents = [] } = useQuery<StudentType[]>({
    queryKey: ["course-students", id],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/courses/${id}/students`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!id,
  });
  const { data: timetableSlots = [] } = useQuery<TimetableSlot[]>({
    queryKey: ["course-slots", id],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/courses/${id}/slots`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!id,
    refetchInterval: 5000,
  });
  const { data: courseAssessments } = useListAssessments({ courseId: id }, { query: { enabled: !!id } as any });

  const invalidateSlots = () => qc.invalidateQueries({ queryKey: ["course-slots", id] });

  const createSlot = useMutation({
    mutationFn: async (body: SlotFormState) => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/courses/${id}/slots`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to create slot");
      return r.json();
    },
    onSuccess: () => { invalidateSlots(); setAddingSlot(false); setSlotForm(EMPTY_SLOT); },
  });

  const updateSlot = useMutation({
    mutationFn: async ({ slotId, body }: { slotId: number; body: SlotFormState }) => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/courses/${id}/slots/${slotId}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to update slot");
      return r.json();
    },
    onSuccess: () => { invalidateSlots(); setEditingSlotId(null); setSlotForm(EMPTY_SLOT); },
  });

  const deleteSlot = useMutation({
    mutationFn: async (slotId: number) => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      await fetch(`${base}/api/courses/${id}/slots/${slotId}`, {
        method: "DELETE", credentials: "include",
      });
    },
    onSuccess: invalidateSlots,
  });

  if (isLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (!course) {
    return <div className="p-12 text-center text-muted-foreground">Course not found.</div>;
  }

  const faculty = (course as CourseType).faculty ?? "—";
  const level   = (course as CourseType).level   ?? "—";
  const academicYear  = (course as CourseType).academicYear  ?? "2024/25";
  const courseHours   = (course as CourseType).courseHours   ?? 180;
  const courseStatus  = (course as CourseType).status        ?? "Active";
  const centuryId = `CTY-${String(id).padStart(4, "0")}`;
  // Derive a representative time for legacy print helpers (uses first timetable slot if available)
  const firstSlot = timetableSlots[0];
  const dayOfWeek  = firstSlot?.day      ?? DAYS[id % DAYS.length];
  const startTime  = firstSlot?.startTime ?? START_TIMES[id % START_TIMES.length];
  const endTime    = firstSlot?.endTime   ?? (() => { const [h] = (firstSlot?.startTime ?? START_TIMES[id % START_TIMES.length]).split(":").map(Number); return `${String(h + 1).padStart(2, "0")}:00`; })();

  const presentCount = attendance?.filter(a => a.status === "present").length ?? 0;
  const absentCount = attendance?.filter(a => a.status === "absent").length ?? 0;
  const lateCount = attendance?.filter(a => a.status === "late").length ?? 0;

  function exportCSV() {
    if (!course) return;
    const rows = [
      ["Student Name", "Person Code", "Gender", "Year Group", "Attendance %"],
      ...enrolledStudents.map(s => [
        `${s.forename} ${s.surname}`, s.personCode, s.gender ?? "", s.yearGroup ?? "", `${s.attendancePercent}%`
      ]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${course.code}-enrolled-learners.csv`;
    a.click();
  }

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      {/* ── Left Links Pane ── */}
      <div className="w-44 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Course Links</p>
        </div>
        {COURSE_LINKS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => {
                if (label === "Progressions") { navigate(`/courses/${id}/progressions`); return; }
                setActiveLink(label);
              }}
            className={`w-full text-left text-xs px-4 py-2 border-b border-slate-100 transition-colors flex items-center gap-2 ${
              activeLink === label ? "bg-teal-700 text-white font-semibold" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon className="w-3 h-3 shrink-0" /> {label}
          </button>
        ))}
      </div>

      {/* ── Center Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Header bar */}
        <div className="bg-white border-b border-slate-200 px-5 py-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-800">{course.name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">Code: {course.code} &nbsp;|&nbsp; {level} &nbsp;|&nbsp; {faculty} &nbsp;|&nbsp; Status: {courseStatus}</p>
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Download className="w-3 h-3" /> Export List
              </button>
              <button
                onClick={() => printCurriculumWindow(course, level, faculty, dayOfWeek, startTime, endTime, courseAssessments ?? [], presentCount, absentCount, lateCount)}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <FileText className="w-3 h-3" /> Print Curriculum
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-5">
          {/* ── Enrolled Learners ── */}
          {activeLink === "Enrolled Learners" && (
            <div className="space-y-4">
              <Section title={`Enrolled Learners (${enrolledStudents.length})`}>
                {enrolledStudents.length === 0 ? (
                  <p className="text-xs text-slate-400">No learners enrolled. Add your data to populate.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left font-semibold text-slate-600 pb-2 pr-6">Name</th>
                        <th className="text-left font-semibold text-slate-600 pb-2 pr-6">Ref</th>
                        <th className="text-left font-semibold text-slate-600 pb-2 pr-6">Gender</th>
                        <th className="text-left font-semibold text-slate-600 pb-2 pr-6">Year Group</th>
                        <th className="text-left font-semibold text-slate-600 pb-2">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {enrolledStudents.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                          <td className="py-1.5 pr-6 text-sky-700 hover:underline">{s.forename} {s.surname}</td>
                          <td className="py-1.5 pr-6 text-slate-500">{s.personCode}</td>
                          <td className="py-1.5 pr-6 text-slate-600">{s.gender ?? "—"}</td>
                          <td className="py-1.5 pr-6 text-slate-600">{s.yearGroup ?? "—"}</td>
                          <td className="py-1.5">
                            <span className={`font-semibold ${s.attendancePercent < 90 ? "text-red-600" : "text-emerald-600"}`}>{s.attendancePercent}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            </div>
          )}

          {/* ── Course Details (shown as sub-sections) ── */}
          {activeLink !== "Enrolled Learners" && (
            <div className="space-y-0">
              <Section title="Course Details">
                <div className="grid grid-cols-2 gap-x-12">
                  <div className="space-y-1">
                    <InfoRow label="Course Code" value={course.code} />
                    <InfoRow label="Course Name" value={course.name} />
                    <InfoRow label="Occurrence" value="Current Year" />
                    <InfoRow label="Academic Year" value={academicYear} />
                    <InfoRow label="Level" value={level} />
                    <InfoRow label="Faculty / Department" value={faculty} />
                  </div>
                  <div className="space-y-1">
                    <InfoRow label="Course Leader" value={course.staffName} />
                    <InfoRow label="Owning Organisation" value={faculty} />
                    <InfoRow label="Start Date" value="01/08/2024" />
                    <InfoRow label="End Date" value="31/07/2025" />
                    <InfoRow label="Status" value={`Live / Published (${courseStatus.toUpperCase()})`} />
                    <InfoRow label="Course Hours" value={String(courseHours)} />
                  </div>
                </div>
              </Section>

              <Section title="Course Place Totals">
                <div className="grid grid-cols-2 gap-x-12">
                  <div className="space-y-1">
                    <InfoRow label="Total Places" value={course.enrolledCount} />
                    <InfoRow label="Active Places" value={Math.max(0, course.enrolledCount - absentCount)} />
                    <InfoRow label="Transferred Places" value={0} />
                    <InfoRow label="Withdraw Places" value={0} />
                  </div>
                  <div className="space-y-1">
                    <InfoRow label="Non Starter Places" value={absentCount} />
                    <InfoRow label="Finished Places" value={lateCount} />
                    <InfoRow label="Waiting" value={0} />
                    <InfoRow label="Remaining Places" value={Math.max(0, course.enrolledCount - presentCount)} />
                  </div>
                </div>
              </Section>

              <Section title="Century Details">
                <div className="grid grid-cols-2 gap-x-12">
                  <div className="space-y-1">
                    <InfoRow label="Century ID" value={centuryId} />
                    <InfoRow label="Century Name" value={`${course.name} — ${new Date().getFullYear()}`} />
                    <InfoRow label="Primary Lecturer" value={course.staffName} />
                  </div>
                  <div className="space-y-1">
                    <InfoRow label="Room" value={course.room} />
                    <InfoRow label="Planned Hours" value="180" />
                    <InfoRow label="Actual Hours" value={String(Math.round(180 * (attendance?.length ? 0.85 : 0)))} />
                  </div>
                </div>
              </Section>

              {activeLink === "Timetable Slots" && (
                <Section title={`Timetable Slots (${timetableSlots.length})`}>
                  <div className="space-y-3">
                    {/* Slot table */}
                    {timetableSlots.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Day</th>
                            <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Start</th>
                            <th className="text-left font-semibold text-slate-600 pb-2 pr-4">End</th>
                            <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Room</th>
                            <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Week Pattern</th>
                            {canEditTimetable && <th className="pb-2 w-16" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {timetableSlots.map(slot => (
                            editingSlotId === slot.id ? (
                              <tr key={slot.id} className="bg-teal-50">
                                <td className="py-1.5 pr-2">
                                  <select value={slotForm.day} onChange={e => setSlotForm(f => ({ ...f, day: e.target.value }))}
                                    className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full">
                                    {DAYS.map(d => <option key={d}>{d}</option>)}
                                  </select>
                                </td>
                                <td className="py-1.5 pr-2">
                                  <input type="time" value={slotForm.startTime} onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))}
                                    className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full" />
                                </td>
                                <td className="py-1.5 pr-2">
                                  <input type="time" value={slotForm.endTime} onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))}
                                    className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full" />
                                </td>
                                <td className="py-1.5 pr-2">
                                  <input value={slotForm.room} onChange={e => setSlotForm(f => ({ ...f, room: e.target.value }))}
                                    placeholder="Room" className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full" />
                                </td>
                                <td className="py-1.5 pr-2">
                                  <select value={slotForm.weekPattern} onChange={e => setSlotForm(f => ({ ...f, weekPattern: e.target.value }))}
                                    className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full">
                                    {WEEK_PATTERNS.map(p => <option key={p}>{p}</option>)}
                                  </select>
                                </td>
                                <td className="py-1.5">
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={() => updateSlot.mutate({ slotId: slot.id, body: slotForm })}
                                      disabled={updateSlot.isPending}
                                      className="p-1 rounded text-teal-700 hover:bg-teal-100" title="Save">
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => { setEditingSlotId(null); setSlotForm(EMPTY_SLOT); }}
                                      className="p-1 rounded text-slate-500 hover:bg-slate-100" title="Cancel">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              <tr key={slot.id} className="hover:bg-slate-50">
                                <td className="py-1.5 pr-4 text-slate-700">{slot.day ?? "—"}</td>
                                <td className="py-1.5 pr-4 text-slate-700">{slot.startTime}</td>
                                <td className="py-1.5 pr-4 text-slate-700">{slot.endTime}</td>
                                <td className="py-1.5 pr-4 text-slate-700">{slot.room ?? "—"}</td>
                                <td className="py-1.5 pr-4 text-slate-500">{slot.weekPattern}</td>
                                {canEditTimetable && (
                                  <td className="py-1.5">
                                    <div className="flex gap-1 justify-end">
                                      <button onClick={() => { setEditingSlotId(slot.id); setAddingSlot(false); setSlotForm({ day: slot.day ?? "Monday", startTime: slot.startTime, endTime: slot.endTime, room: slot.room ?? "", weekPattern: slot.weekPattern }); }}
                                        className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-teal-700" title="Edit">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => { if (confirm("Remove this timetable slot?")) deleteSlot.mutate(slot.id); }}
                                        className="p-1 rounded text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            )
                          ))}
                        </tbody>
                      </table>
                    )}

                    {timetableSlots.length === 0 && !addingSlot && (
                      <p className="text-xs text-slate-400">No timetable slots set for this course yet.</p>
                    )}

                    {/* Add slot form */}
                    {canEditTimetable && addingSlot && (
                      <div className="border border-teal-200 rounded bg-teal-50 p-3">
                        <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide mb-2">New Slot</p>
                        <div className="grid grid-cols-5 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Day</label>
                            <select value={slotForm.day} onChange={e => setSlotForm(f => ({ ...f, day: e.target.value }))}
                              className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full bg-white">
                              {DAYS.map(d => <option key={d}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Start time</label>
                            <input type="time" value={slotForm.startTime} onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))}
                              className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">End time</label>
                            <input type="time" value={slotForm.endTime} onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))}
                              className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Room</label>
                            <input value={slotForm.room} onChange={e => setSlotForm(f => ({ ...f, room: e.target.value }))}
                              placeholder="e.g. B12" className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full bg-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Week pattern</label>
                            <select value={slotForm.weekPattern} onChange={e => setSlotForm(f => ({ ...f, weekPattern: e.target.value }))}
                              className="text-xs border border-slate-300 rounded px-1.5 py-1 w-full bg-white">
                              {WEEK_PATTERNS.map(p => <option key={p}>{p}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => createSlot.mutate(slotForm)} disabled={createSlot.isPending}
                            className="flex items-center gap-1.5 text-xs bg-teal-700 text-white rounded px-3 py-1.5 hover:bg-teal-800 disabled:opacity-50">
                            <Check className="w-3 h-3" /> {createSlot.isPending ? "Saving…" : "Save slot"}
                          </button>
                          <button onClick={() => { setAddingSlot(false); setSlotForm(EMPTY_SLOT); }}
                            className="text-xs border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Add slot button */}
                    {canEditTimetable && !addingSlot && editingSlotId === null && (
                      <button onClick={() => { setAddingSlot(true); setSlotForm(EMPTY_SLOT); }}
                        className="flex items-center gap-1.5 text-xs text-teal-700 border border-teal-300 rounded px-3 py-1.5 hover:bg-teal-50 mt-1">
                        <Plus className="w-3 h-3" /> Add timetable slot
                      </button>
                    )}
                  </div>
                </Section>
              )}

              {activeLink === "Course Units / Modules" && (
                <Section title="Course Units / Modules">
                  <p className="text-xs text-slate-400">No units or modules on record. Add your data to populate this section.</p>
                </Section>
              )}

              {activeLink === "Learning Resources" && (
                <Section title="Learning Resources">
                  <p className="text-xs text-slate-400">No learning resources linked. Add your data to populate this section.</p>
                </Section>
              )}

              {activeLink === "Assessment Plan" && (
                <Section title={`Assessment Plan (${courseAssessments?.length ?? 0} assessments)`}>
                  {courseAssessments?.length ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Code</th>
                          <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Description</th>
                          <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Type</th>
                          <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Due Date</th>
                          <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Grading Scheme</th>
                          <th className="text-left font-semibold text-slate-600 pb-2 pr-4">Min Pass</th>
                          <th className="text-center font-semibold text-slate-600 pb-2 pr-4">Mandatory</th>
                          <th className="text-left font-semibold text-slate-600 pb-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {courseAssessments.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50">
                            <td className="py-1.5 pr-4 font-medium text-slate-800">{a.code}</td>
                            <td className="py-1.5 pr-4 text-slate-700">{a.description}</td>
                            <td className="py-1.5 pr-4 text-slate-500">{a.type}</td>
                            <td className="py-1.5 pr-4 text-slate-500">{a.dueDate ?? "—"}</td>
                            <td className="py-1.5 pr-4 text-slate-500">{a.gradingScheme}</td>
                            <td className="py-1.5 pr-4 text-slate-500">{a.minPassMark ?? "—"}</td>
                            <td className="py-1.5 pr-4 text-center">{a.mandatory ? "✓" : "—"}</td>
                            <td className="py-1.5">
                              <button onClick={() => navigate(`/assessments/${a.id}`)}
                                className="flex items-center gap-1 text-xs text-sky-700 hover:underline">
                                <PenTool className="w-3 h-3" /> Mark
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">No assessments on record for this course.</p>
                      <button onClick={() => navigate("/assessments")}
                        className="flex items-center gap-1 text-xs text-teal-700 hover:underline">
                        <PenTool className="w-3 h-3" /> Go to My Assessments to add one
                      </button>
                    </div>
                  )}
                </Section>
              )}

              {activeLink === "Staff Assignments" && (
                <Section title="Staff Assignments">
                  {course.staffName ? (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-slate-100"><th className="text-left font-semibold text-slate-600 pb-2 pr-6">Staff Name</th><th className="text-left font-semibold text-slate-600 pb-2 pr-6">Role</th><th className="text-left font-semibold text-slate-600 pb-2">Hours / Week</th></tr></thead>
                      <tbody>
                        <tr className="hover:bg-slate-50">
                          <td className="py-1.5 pr-6 text-sky-700">{course.staffName}</td>
                          <td className="py-1.5 pr-6 text-slate-700">Primary Lecturer</td>
                          <td className="py-1.5 text-slate-600">3</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : <p className="text-xs text-slate-400">No staff assigned.</p>}
                </Section>
              )}

              <Section title="Recent Registers" defaultOpen={false}>
                {attendance?.length ? (
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-100"><th className="text-left font-semibold text-slate-600 pb-2 pr-6">Student</th><th className="text-left font-semibold text-slate-600 pb-2 pr-6">Date</th><th className="text-left font-semibold text-slate-600 pb-2">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {attendance.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-1.5 pr-6 text-slate-700">{r.studentName ?? "—"}</td>
                          <td className="py-1.5 pr-6 text-slate-500">{r.date}</td>
                          <td className="py-1.5"><span className={`font-semibold capitalize ${r.status === "present" ? "text-emerald-600" : r.status === "absent" ? "text-red-600" : r.status === "late" ? "text-amber-600" : "text-blue-600"}`}>{r.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-xs text-slate-400">No attendance records for this course.</p>}
              </Section>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Reports Pane ── */}
      <div className="w-44 shrink-0 bg-white border-l border-slate-200 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reports</p>
        </div>
        {COURSE_REPORTS.map(r => (
          <button key={r} onClick={() => setReportOpen(r)} className="w-full text-left text-xs px-4 py-2 border-b border-slate-100 text-sky-700 hover:bg-sky-50 flex items-center gap-1.5 transition-colors">
            <FileText className="w-3 h-3 shrink-0 text-sky-500" />{r}
          </button>
        ))}
      </div>

      <CourseReportDialog
        reportName={reportOpen}
        course={course}
        level={level}
        faculty={faculty}
        attendance={attendance ?? []}
        students={enrolledStudents}
        assessments={courseAssessments ?? []}
        onClose={() => setReportOpen(null)}
      />
    </div>
  );
}
