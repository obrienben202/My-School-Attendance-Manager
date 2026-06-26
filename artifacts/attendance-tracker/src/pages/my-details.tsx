import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListCourses } from "@workspace/api-client-react";
import {
  UserCircle, Mail, Phone, MapPin, Building2, BadgeCheck,
  Calendar, BookOpen, ClipboardList, Info, ExternalLink,
  ShieldCheck, Lock, Printer,
} from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-teal-700">{icon}</span>
        <h2 className="text-sm font-bold text-gray-700">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="w-44 shrink-0 text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm text-gray-800">{value || "—"}</span>
    </div>
  );
}

// ─── Timetable constants ────────────────────────────────────────────────────────
const TT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TT_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
const TT_LESSONS = ["Lesson 1", "Lesson 2", "Lesson 3", "Lesson 4", "Lesson 5", "Lesson 6"];
const TT_PERIODS = ["09:00–10:00", "10:00–11:00", "11:15–12:15", "13:00–14:00", "14:00–15:00", "15:00–16:00"];

// Build a cell-map: lesson-index → day-index → course
type TtCourse = { id: number; code: string; name: string; room?: string | null; staffName?: string | null };
function buildTtGrid(courses: TtCourse[]): Record<string, TtCourse> {
  const map: Record<string, TtCourse> = {};
  courses.forEach((c, i) => { map[`${Math.floor(i / 5)}-${i % 5}`] = c; });
  return map;
}

// Colors for course blocks (cycling)
const BLOCK_COLORS = [
  "bg-rose-300 border-rose-400 text-rose-900",
  "bg-sky-300 border-sky-400 text-sky-900",
  "bg-violet-300 border-violet-400 text-violet-900",
  "bg-amber-300 border-amber-400 text-amber-900",
  "bg-emerald-300 border-emerald-400 text-emerald-900",
];

function printStaffTimetable(fullName: string, courses: TtCourse[]) {
  const grid = buildTtGrid(courses);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const dayHeaders = TT_DAYS.map(d =>
    `<th style="border:1px solid #bbb;padding:6px 4px;text-align:center;background:#f0f0f0;font-size:11px;min-width:100px;">${d}</th>`
  ).join("");
  const lessonRow = (label: string, period: string, idx: number) => {
    const cells = TT_DAYS.map((_, d) => {
      const c = grid[`${idx}-${d}`];
      return c
        ? `<td style="border:1px solid #bbb;padding:4px 6px;font-size:10px;background:#f9d0d0;">
            <strong>${c.code}</strong><br/>${c.name}${c.room ? `<br/><span style="color:#555">${c.room}</span>` : ""}
           </td>`
        : `<td style="border:1px solid #bbb;padding:4px 6px;"></td>`;
    }).join("");
    return `<tr>
      <td style="border:1px solid #bbb;padding:5px 6px;font-weight:bold;font-size:11px;background:#fafafa;white-space:nowrap;">${label}</td>
      <td style="border:1px solid #bbb;padding:5px 6px;font-size:10px;background:#fafafa;color:#666;">${period}</td>
      ${cells}
    </tr>`;
  };
  const breakRow = (label: string) =>
    `<tr><td colspan="${TT_DAYS.length + 2}" style="border:1px solid #bbb;padding:4px;text-align:center;font-style:italic;font-size:11px;color:#555;background:#f9f9f9;">${label}</td></tr>`;

  const html = `
<h1 style="font-size:16px;font-weight:bold;text-align:center;margin-bottom:4px;">Timetable</h1>
<p style="font-size:11px;color:#555;text-align:center;margin-bottom:12px;">Staff: ${fullName} &nbsp;|&nbsp; Generated: ${today} &nbsp;|&nbsp; Academic Year 2024/25</p>
<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
  <thead>
    <tr>
      <th style="border:1px solid #bbb;padding:6px 4px;width:70px;background:#f0f0f0;font-size:11px;"></th>
      <th style="border:1px solid #bbb;padding:6px 4px;width:90px;background:#f0f0f0;font-size:11px;">Time</th>
      ${dayHeaders}
    </tr>
  </thead>
  <tbody>
    ${lessonRow("Lesson 1", TT_PERIODS[0], 0)}
    ${lessonRow("Lesson 2", TT_PERIODS[1], 1)}
    ${breakRow("Break")}
    ${lessonRow("Lesson 3", TT_PERIODS[2], 2)}
    ${lessonRow("Lesson 4", TT_PERIODS[3], 3)}
    ${breakRow("Lunch")}
    ${lessonRow("Lesson 5", TT_PERIODS[4], 4)}
    ${lessonRow("Lesson 6", TT_PERIODS[5], 5)}
  </tbody>
</table>`;

  const w = window.open("", "_blank", "width=950,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Staff Timetable</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#222;}@media print{body{margin:10px;}}</style>
</head><body onload="window.print()">${html}</body></html>`);
  w.document.close();
}

// ─── Sample employment data ────────────────────────────────────────────────────
// In a real EBS deployment these would come from the staff record in the back-end.

const EMPLOYMENT = {
  staffCode: "S0001",
  title: "Mr",
  knownAs: "",
  gender: "Not disclosed",
  dateOfBirth: "—",
  niNumber: "•••• ••••",
  startDate: "01 Sep 2019",
  contractType: "Permanent",
  fte: "1.0 (Full-time)",
  position: "Senior Teacher",
  department: "Mathematics",
  organisation: "Riverside College",
  room: "Maths Block — Room M4",
  phone: "01234 567890",
  mobile: "—",
  address: "Riverside College, Education Road, Riverside, RS1 2AB",
  roles: ["Create Schedules", "Safeguarding Tutor", "Reports User"],
};

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function MyDetails() {
  const { user } = useAuth();
  const { data: courses = [] } = useListCourses({ query: { enabled: true } as any });
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const firstName = user?.firstName ?? "Staff";
  const lastName = user?.lastName ?? "Member";
  const fullName = `${firstName} ${lastName}`;
  const email = user?.email ?? "—";
  const avatarUrl = user?.profileImageUrl;

  // Filter courses loosely attributed to this user (demo — in real EBS, filtered by staffId)
  const myCourses = courses.slice(0, 5);

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center gap-3">
        <UserCircle size={18} className="text-teal-700" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Details</h1>
          <p className="text-sm text-gray-500">Your staff record — read-only. Contact your administrator to update any details.</p>
        </div>
      </div>

      {/* Read-only notice */}
      <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-700">
        <Lock size={12} className="shrink-0" />
        <span>
          <strong>Read-only view.</strong> You cannot edit your details from this page. Any changes must be made by your administrator in the EBS back-end system.
        </span>
      </div>

      <div className="px-6 py-6 max-w-4xl space-y-5">

        {/* Profile card */}
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 flex items-center gap-5">
          <div className="shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-16 h-16 rounded-full object-cover border-2 border-teal-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center border-2 border-teal-200">
                <span className="text-2xl font-bold text-teal-700">
                  {firstName[0]}{lastName[0]}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{EMPLOYMENT.title} {fullName}</h2>
            <p className="text-sm text-gray-500">{EMPLOYMENT.position} · {EMPLOYMENT.department}</p>
            <p className="text-xs text-gray-400 mt-0.5">{EMPLOYMENT.organisation}</p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <span className="text-xs font-mono text-gray-500 bg-gray-100 border border-gray-200 rounded px-2 py-0.5">
              Staff code: {EMPLOYMENT.staffCode}
            </span>
            <div className="flex flex-wrap gap-1 justify-end">
              {EMPLOYMENT.roles.map((r) => (
                <span key={r} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full font-medium">
                  <ShieldCheck size={9} /> {r}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Personal details */}
          <Section title="Personal Details" icon={<UserCircle size={14} />}>
            <Row label="Title" value={EMPLOYMENT.title} />
            <Row label="Forename" value={firstName} />
            <Row label="Known as" value={EMPLOYMENT.knownAs || firstName} />
            <Row label="Surname" value={lastName} />
            <Row label="Full name" value={fullName} />
            <Row label="Gender" value={EMPLOYMENT.gender} />
            <Row label="Date of birth" value={EMPLOYMENT.dateOfBirth} />
            <Row label="NI number" value={EMPLOYMENT.niNumber} />
          </Section>

          {/* Contact details */}
          <Section title="Contact Details" icon={<Mail size={14} />}>
            <div className="flex items-center gap-2 py-2 border-b border-gray-50">
              <Mail size={13} className="text-gray-400 shrink-0" />
              <span className="w-28 shrink-0 text-xs font-semibold text-gray-500">Email</span>
              <span className="text-sm text-gray-800 break-all">{email}</span>
            </div>
            <div className="flex items-center gap-2 py-2 border-b border-gray-50">
              <Phone size={13} className="text-gray-400 shrink-0" />
              <span className="w-28 shrink-0 text-xs font-semibold text-gray-500">Phone</span>
              <span className="text-sm text-gray-800">{EMPLOYMENT.phone}</span>
            </div>
            <div className="flex items-center gap-2 py-2 border-b border-gray-50">
              <Phone size={13} className="text-gray-400 shrink-0" />
              <span className="w-28 shrink-0 text-xs font-semibold text-gray-500">Mobile</span>
              <span className="text-sm text-gray-800">{EMPLOYMENT.mobile || "—"}</span>
            </div>
            <div className="flex items-start gap-2 py-2">
              <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
              <span className="w-28 shrink-0 text-xs font-semibold text-gray-500">Address</span>
              <span className="text-sm text-gray-800 leading-snug">{EMPLOYMENT.address}</span>
            </div>
          </Section>

          {/* Employment details */}
          <Section title="Employment Details" icon={<Building2 size={14} />}>
            <Row label="Staff code" value={EMPLOYMENT.staffCode} />
            <Row label="Department" value={EMPLOYMENT.department} />
            <Row label="Position" value={EMPLOYMENT.position} />
            <Row label="Organisation" value={EMPLOYMENT.organisation} />
            <Row label="Room" value={EMPLOYMENT.room} />
            <Row label="Contract type" value={EMPLOYMENT.contractType} />
            <Row label="FTE" value={EMPLOYMENT.fte} />
            <Row label="Start date" value={EMPLOYMENT.startDate} />
          </Section>

          {/* Organisations */}
          <Section title="Organisations" icon={<BadgeCheck size={14} />}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Organisation</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2">Position</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2">Start</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="py-2 pr-4 text-gray-700">{EMPLOYMENT.department}</td>
                  <td className="py-2 text-gray-700">{EMPLOYMENT.position}</td>
                  <td className="py-2 text-gray-500 text-xs">{EMPLOYMENT.startDate}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-gray-700">{EMPLOYMENT.organisation}</td>
                  <td className="py-2 text-gray-700">Staff Member</td>
                  <td className="py-2 text-gray-500 text-xs">{EMPLOYMENT.startDate}</td>
                </tr>
              </tbody>
            </table>
          </Section>
        </div>

        {/* Courses / timetable */}
        <Section title="My Courses" icon={<BookOpen size={14} />}>
          {myCourses.length === 0 ? (
            <p className="text-sm text-gray-400">No courses currently assigned.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Code", "Course name", "Room", "Enrolled", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myCourses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 pr-4 font-mono text-xs text-teal-700 font-semibold">{c.code}</td>
                    <td className="py-2 pr-4 text-gray-800">{c.name}</td>
                    <td className="py-2 pr-4 text-gray-500">{c.room ?? "—"}</td>
                    <td className="py-2 pr-4 text-gray-500">{c.enrolledCount}</td>
                    <td className="py-2">
                      <Link href={`/courses/${c.id}`} className="text-[10px] text-teal-700 hover:underline flex items-center gap-0.5">
                        View <ExternalLink size={9} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Reports links */}
        <Section title="Reports &amp; Links" icon={<ClipboardList size={14} />}>
          <p className="text-xs text-gray-500 mb-3">
            Timetable and other reports are accessible from the Reports section of the navigation pane.
          </p>
          <div className="flex flex-wrap gap-2">
            {["My Attendance Reports", "My Timetable", "Register History", "My Schedules", "Planned Absences"].map(label => (
              <button
                key={label}
                onClick={() => setActiveModal(label)}
                className="flex items-center gap-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded px-3 py-1.5 hover:bg-teal-100 transition-colors font-medium"
              >
                <ExternalLink size={11} /> {label}
              </button>
            ))}
          </div>
        </Section>

        {/* Admin notice */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Need to update your details?</p>
            <p className="text-xs leading-relaxed">
              Your personal details, contact information, and employment record are managed by your institution's administrator in the EBS back-end system.
              Please contact your administrator or HR department to request any changes.
            </p>
          </div>
        </div>

      </div>

      {/* ── My Timetable Dialog ── */}
      <Dialog open={activeModal === "My Timetable"} onOpenChange={o => { if (!o) setActiveModal(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <div className="bg-teal-800 text-white px-5 py-3 flex items-start justify-between">
            <div>
              <DialogHeader>
                <DialogTitle className="text-white text-base font-bold">My Timetable</DialogTitle>
              </DialogHeader>
              <p className="text-teal-200 text-xs mt-0.5">
                {EMPLOYMENT.title} {fullName} &nbsp;|&nbsp; {EMPLOYMENT.department} &nbsp;|&nbsp; Academic Year 2024/25 &nbsp;|&nbsp; Session: 1718 &nbsp;|&nbsp; Weeks: 10
              </p>
            </div>
            <button
              onClick={() => printStaffTimetable(`${EMPLOYMENT.title} ${fullName}`, myCourses)}
              className="ml-4 flex items-center gap-1.5 bg-white text-teal-800 text-xs font-semibold px-3 py-1.5 rounded hover:bg-teal-50 shrink-0"
            >
              <Printer size={13} /> Print
            </button>
          </div>

          {/* Calendar-style weekly grid */}
          <div className="flex-1 overflow-auto p-4 bg-slate-50">
            <p className="text-xs text-slate-500 mb-3">Select a session block to view course details. Showing week view — Mon to Fri.</p>
            <div className="overflow-x-auto">
              {/* Time axis header */}
              <div className="flex" style={{ minWidth: 900 }}>
                <div className="w-20 shrink-0" />
                {TT_TIMES.map(t => (
                  <div key={t} className="flex-1 text-center text-[10px] font-mono text-slate-500 pb-1 border-b border-slate-200">{t}</div>
                ))}
              </div>
              {/* Day rows */}
              {TT_DAYS.map((day, di) => {
                const dayLessons = TT_LESSONS.map((_, li) => {
                  const grid = buildTtGrid(myCourses);
                  return grid[`${li}-${di}`] ?? null;
                });
                return (
                  <div key={day} className="flex border-b border-slate-200" style={{ minWidth: 900, minHeight: 80 }}>
                    <div className="w-20 shrink-0 flex items-center justify-center border-r border-slate-200 bg-slate-100">
                      <span className="text-[11px] font-bold text-slate-600 [writing-mode:vertical-lr] rotate-180">{day}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100">
                      {TT_TIMES.map((_, ti) => {
                        // Map time slot to lesson index (slots 0-1 = lessons 0-1, slot 2 = break, slots 3-4 = lessons 2-3, slot 5 = lunch, slot 6 = lesson 4)
                        const lessonIdx = ti === 2 ? -1 : ti === 5 ? -2 : ti < 2 ? ti : ti < 5 ? ti - 1 : ti - 2;
                        const isBreak = ti === 2;
                        const isLunch = ti === 5;
                        const course = lessonIdx >= 0 ? dayLessons[lessonIdx] ?? null : null;
                        const colorCls = course ? BLOCK_COLORS[course.id % BLOCK_COLORS.length] : "";
                        return (
                          <div
                            key={ti}
                            className={`relative p-1 min-h-[76px] ${isBreak || isLunch ? "bg-slate-100" : "bg-white hover:bg-slate-50"}`}
                          >
                            {isBreak && <span className="text-[9px] text-slate-400 font-medium">Break</span>}
                            {isLunch && <span className="text-[9px] text-slate-400 font-medium">Lunch</span>}
                            {course && !isBreak && !isLunch && (
                              <div className={`rounded border p-1 text-[9px] leading-tight ${colorCls}`}>
                                <div className="font-bold">{course.code}</div>
                                <div className="opacity-90 mt-0.5">{course.name}</div>
                                {course.room && <div className="opacity-75 mt-0.5">{course.room}</div>}
                                {course.staffName && <div className="opacity-75">{course.staffName}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── My Attendance Reports Dialog ── */}
      <Dialog open={activeModal === "My Attendance Reports"} onOpenChange={o => { if (!o) setActiveModal(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden p-0">
          <div className="bg-teal-800 text-white px-5 py-3">
            <DialogHeader><DialogTitle className="text-white text-base font-bold">My Attendance Reports</DialogTitle></DialogHeader>
            <p className="text-teal-200 text-xs mt-0.5">{EMPLOYMENT.title} {fullName} &nbsp;|&nbsp; Academic Year 2024/25</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs text-slate-500 mb-3">Attendance summary across all assigned courses for this academic year.</p>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-teal-800 text-white">
                {["Course", "Sessions Taken", "Present", "Absent", "Late", "Avg Rate"].map(h => (
                  <th key={h} className="text-left px-3 py-1.5 font-semibold">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {myCourses.length ? myCourses.map(c => {
                  const present = Math.round(c.enrolledCount * 0.85);
                  const absent = Math.round(c.enrolledCount * 0.10);
                  const late = c.enrolledCount - present - absent;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-medium text-slate-800">{c.code} — {c.name}</td>
                      <td className="px-3 py-1.5 text-center text-slate-600">{c.enrolledCount}</td>
                      <td className="px-3 py-1.5 text-center text-green-700 font-semibold">{present}</td>
                      <td className="px-3 py-1.5 text-center text-red-600 font-semibold">{absent}</td>
                      <td className="px-3 py-1.5 text-center text-amber-700 font-semibold">{late}</td>
                      <td className="px-3 py-1.5 text-center font-bold text-green-700">85%</td>
                    </tr>
                  );
                }) : <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No attendance data.</td></tr>}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Register History Dialog ── */}
      <Dialog open={activeModal === "Register History"} onOpenChange={o => { if (!o) setActiveModal(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden p-0">
          <div className="bg-teal-800 text-white px-5 py-3">
            <DialogHeader><DialogTitle className="text-white text-base font-bold">Register History</DialogTitle></DialogHeader>
            <p className="text-teal-200 text-xs mt-0.5">Recent registers submitted by {EMPLOYMENT.title} {fullName}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-teal-800 text-white">
                {["Date", "Course", "Session", "Submitted", "Status"].map(h => (
                  <th key={h} className="text-left px-3 py-1.5 font-semibold">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {myCourses.slice(0, 3).flatMap((c, ci) =>
                  [0, 1, 2].map(offset => {
                    const d = new Date(); d.setDate(d.getDate() - (ci * 7 + offset * 2));
                    return (
                      <tr key={`${c.id}-${offset}`} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-slate-600">{d.toLocaleDateString("en-GB")}</td>
                        <td className="px-3 py-1.5 text-slate-800 font-medium">{c.code}</td>
                        <td className="px-3 py-1.5 text-slate-600">{offset % 2 === 0 ? "AM" : "PM"}</td>
                        <td className="px-3 py-1.5 text-slate-600">{d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-3 py-1.5"><span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border text-green-700 bg-green-50 border-green-200">Submitted</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── My Schedules Dialog ── */}
      <Dialog open={activeModal === "My Schedules"} onOpenChange={o => { if (!o) setActiveModal(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden p-0">
          <div className="bg-teal-800 text-white px-5 py-3">
            <DialogHeader><DialogTitle className="text-white text-base font-bold">My Schedules</DialogTitle></DialogHeader>
            <p className="text-teal-200 text-xs mt-0.5">{EMPLOYMENT.title} {fullName} &nbsp;|&nbsp; Academic Year 2024/25</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-teal-800 text-white">
                {["Course", "Day", "Start", "End", "Room", "Week Pattern"].map(h => (
                  <th key={h} className="text-left px-3 py-1.5 font-semibold">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {myCourses.length ? myCourses.map((c, i) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-medium text-slate-800">{c.code} — {c.name}</td>
                    <td className="px-3 py-1.5 text-slate-700">{TT_DAYS[i % TT_DAYS.length]}</td>
                    <td className="px-3 py-1.5 text-slate-600 font-mono">{TT_PERIODS[i % TT_PERIODS.length].split("–")[0]}</td>
                    <td className="px-3 py-1.5 text-slate-600 font-mono">{TT_PERIODS[i % TT_PERIODS.length].split("–")[1]}</td>
                    <td className="px-3 py-1.5 text-slate-600">{c.room ?? "—"}</td>
                    <td className="px-3 py-1.5 text-slate-500">1–49, 51–52</td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No schedules found.</td></tr>}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Planned Absences Dialog ── */}
      <Dialog open={activeModal === "Planned Absences"} onOpenChange={o => { if (!o) setActiveModal(null); }}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col overflow-hidden p-0">
          <div className="bg-teal-800 text-white px-5 py-3">
            <DialogHeader><DialogTitle className="text-white text-base font-bold">Planned Absences</DialogTitle></DialogHeader>
            <p className="text-teal-200 text-xs mt-0.5">{EMPLOYMENT.title} {fullName} &nbsp;|&nbsp; Academic Year 2024/25</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500">Approved leave and planned absences on record.</p>
              <button className="text-xs text-teal-700 border border-teal-200 rounded px-2 py-1 hover:bg-teal-50">+ Request Absence</button>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-teal-800 text-white">
                {["Start Date", "End Date", "Reason", "Status", "Approved By"].map(h => (
                  <th key={h} className="text-left px-3 py-1.5 font-semibold">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { start: "15/07/2025", end: "25/07/2025", reason: "Annual Leave", status: "Approved", by: "Head of Dept" },
                  { start: "28/10/2024", end: "01/11/2024", reason: "Annual Leave", status: "Approved", by: "Head of Dept" },
                  { start: "14/02/2025", end: "14/02/2025", reason: "Medical Appointment", status: "Approved", by: "Line Manager" },
                ].map(a => (
                  <tr key={a.start} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-slate-700">{a.start}</td>
                    <td className="px-3 py-1.5 text-slate-700">{a.end}</td>
                    <td className="px-3 py-1.5 text-slate-800 font-medium">{a.reason}</td>
                    <td className="px-3 py-1.5"><span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border text-green-700 bg-green-50 border-green-200">{a.status}</span></td>
                    <td className="px-3 py-1.5 text-slate-600">{a.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
