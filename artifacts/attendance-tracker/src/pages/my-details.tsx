import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { useListCourses } from "@workspace/api-client-react";
import {
  UserCircle, Mail, Phone, MapPin, Building2, BadgeCheck,
  Calendar, BookOpen, ClipboardList, Info, ExternalLink,
  ShieldCheck, Lock, Printer,
} from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PersonalSlot {
  id: number;
  staffName: string | null;
  day: string;
  lessonNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  description: string;
  groupLabel: string | null;
  room: string | null;
  isHodShared: boolean;
}

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
const TT_PERIODS = ["09:00–10:00", "10:00–11:00", "11:15–12:15", "13:00–14:00", "14:00–15:00", "15:00–16:00"];

// Time-axis grid: 08:30 → 15:30 = 420 mins
const GRID_START = 8.5 * 60;   // 510 mins
const GRID_SPAN  = 7 * 60;     // 420 mins

function toMins(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function gridLeft(t: string | null | undefined): string {
  return `${Math.max(0, (toMins(t) - GRID_START) / GRID_SPAN * 100).toFixed(2)}%`;
}
function gridWidth(start: string | null | undefined, end: string | null | undefined): string {
  const w = (toMins(end) - toMins(start)) / GRID_SPAN * 100;
  return `${Math.max(1, w).toFixed(2)}%`;
}

const HOUR_LABELS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00"];

// Non-teaching keywords → neutral grey styling
const NON_TEACHING = /admin|cover|time.?out|free lesson|one.?to.?one|meeting/i;

function slotColor(slot: PersonalSlot): string {
  if (slot.isHodShared) return "bg-amber-100 border-amber-400 text-amber-900";
  if (NON_TEACHING.test(slot.description)) return "bg-slate-100 border-slate-400 text-slate-700";
  const palette = [
    "bg-teal-200 border-teal-500 text-teal-900",
    "bg-indigo-200 border-indigo-500 text-indigo-900",
    "bg-rose-200 border-rose-500 text-rose-900",
    "bg-violet-200 border-violet-500 text-violet-900",
    "bg-sky-200 border-sky-500 text-sky-900",
    "bg-emerald-200 border-emerald-500 text-emerald-900",
  ];
  return palette[(slot.lessonNumber ?? slot.id) % palette.length];
}

function printPersonalTimetable(fullName: string, slots: PersonalSlot[]) {
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const dayHeaders = TT_DAYS.map(d =>
    `<th style="border:1px solid #bbb;padding:6px 8px;text-align:left;background:#f0f0f0;font-size:11px;">${d}</th>`
  ).join("");
  const rows = slots.map(s =>
    `<tr>
      <td style="border:1px solid #bbb;padding:4px 6px;font-size:10px;white-space:nowrap;">${s.day}</td>
      <td style="border:1px solid #bbb;padding:4px 6px;font-size:10px;font-family:monospace;">${s.startTime ?? ""}–${s.endTime ?? ""}</td>
      <td style="border:1px solid #bbb;padding:4px 6px;font-size:10px;"><strong>${s.description}</strong>${s.groupLabel ? ` — ${s.groupLabel}` : ""}</td>
      <td style="border:1px solid #bbb;padding:4px 6px;font-size:10px;color:#555;">${s.room ?? ""}</td>
    </tr>`
  ).join("");
  const html = `
<h1 style="font-size:16px;font-weight:bold;text-align:center;margin-bottom:4px;">Staff Timetable</h1>
<p style="font-size:11px;color:#555;text-align:center;margin-bottom:12px;">${fullName} &nbsp;|&nbsp; Generated: ${today} &nbsp;|&nbsp; Academic Year 2024/25</p>
<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
  <thead><tr>
    <th style="border:1px solid #bbb;padding:6px 8px;background:#f0f0f0;font-size:11px;">Day</th>
    <th style="border:1px solid #bbb;padding:6px 8px;background:#f0f0f0;font-size:11px;">Time</th>
    <th style="border:1px solid #bbb;padding:6px 8px;background:#f0f0f0;font-size:11px;">Session</th>
    <th style="border:1px solid #bbb;padding:6px 8px;background:#f0f0f0;font-size:11px;">Room</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  const w = window.open("", "_blank", "width=820,height=700");
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

  // ── Personal timetable from staff_timetable_slots ────────────────────────
  const { data: mySlots = [] } = useQuery<PersonalSlot[]>({
    queryKey: ["my-timetable"],
    queryFn: async () => {
      const r = await fetch("/api/staff/my-timetable", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: activeModal === "My Timetable",
    refetchInterval: activeModal === "My Timetable" ? 5000 : false,
  });

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

          {/* Header bar */}
          <div className="bg-teal-800 text-white px-5 py-3 flex items-start justify-between shrink-0">
            <div>
              <DialogHeader>
                <DialogTitle className="text-white text-base font-bold">My Timetable</DialogTitle>
              </DialogHeader>
              <p className="text-teal-200 text-xs mt-0.5">
                {EMPLOYMENT.title} {fullName} &nbsp;|&nbsp; {user?.department ?? EMPLOYMENT.department} &nbsp;|&nbsp; Academic Year 2024/25 &nbsp;|&nbsp; Session: 1718 &nbsp;|&nbsp; Weeks: 10
              </p>
            </div>
            <button
              onClick={() => printPersonalTimetable(`${EMPLOYMENT.title} ${fullName}`, mySlots)}
              className="ml-4 flex items-center gap-1.5 bg-white text-teal-800 text-xs font-semibold px-3 py-1.5 rounded hover:bg-teal-50 shrink-0"
            >
              <Printer size={13} /> Print
            </button>
          </div>

          {/* Time-axis calendar body */}
          <div className="flex-1 overflow-auto bg-slate-50 p-4">
            <p className="text-xs text-slate-500 mb-3">Showing week view — Mon to Fri.</p>

            {mySlots.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-slate-400">
                No personal timetable found for your account.
              </div>
            ) : (
              <div style={{ minWidth: 820 }}>
                {/* ── Time-axis header ── */}
                <div className="flex mb-0.5">
                  <div className="shrink-0" style={{ width: 72 }} />
                  <div className="relative flex-1 h-5">
                    {HOUR_LABELS.map(lbl => (
                      <span
                        key={lbl}
                        className="absolute text-[10px] font-mono text-slate-400 -translate-x-1/2"
                        style={{ left: gridLeft(lbl) }}
                      >
                        {lbl}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ── Day rows ── */}
                {TT_DAYS.map(day => {
                  const daySlots = mySlots.filter(s => s.day === day);
                  return (
                    <div key={day} className="flex border-b border-slate-200 last:border-0" style={{ minHeight: 72 }}>
                      {/* Day label */}
                      <div
                        className="shrink-0 flex items-center justify-center bg-slate-100 border-r border-slate-200 text-[11px] font-bold text-slate-600"
                        style={{ width: 72 }}
                      >
                        {day.slice(0, 3)}
                      </div>

                      {/* Time grid */}
                      <div className="relative flex-1 bg-white" style={{ minHeight: 72 }}>
                        {/* Hour grid lines */}
                        {HOUR_LABELS.map(lbl => (
                          <div
                            key={lbl}
                            className="absolute top-0 bottom-0 border-l border-slate-100"
                            style={{ left: gridLeft(lbl) }}
                          />
                        ))}

                        {/* Break band */}
                        <div
                          className="absolute top-0 bottom-0 bg-slate-50 border-x border-slate-200 flex items-center justify-center"
                          style={{ left: gridLeft("10:30"), width: gridWidth("10:30","10:50") }}
                        >
                          <span className="text-[9px] text-slate-400 font-medium [writing-mode:vertical-lr]">Break</span>
                        </div>

                        {/* Lunch band */}
                        <div
                          className="absolute top-0 bottom-0 bg-slate-50 border-x border-slate-200 flex items-center justify-center"
                          style={{ left: gridLeft("12:50"), width: gridWidth("12:50","13:30") }}
                        >
                          <span className="text-[9px] text-slate-400 font-medium [writing-mode:vertical-lr]">Lunch</span>
                        </div>

                        {/* Lesson blocks */}
                        {daySlots.map(slot => (
                          <div
                            key={slot.id}
                            title={`${slot.description}${slot.groupLabel ? ` — ${slot.groupLabel}` : ""}${slot.room ? ` | ${slot.room}` : ""}`}
                            className={`absolute top-1 bottom-1 rounded border text-[9px] leading-tight px-1 py-0.5 overflow-hidden cursor-default ${slotColor(slot)}`}
                            style={{
                              left: gridLeft(slot.startTime ?? undefined),
                              width: gridWidth(slot.startTime ?? undefined, slot.endTime ?? undefined),
                            }}
                          >
                            <div className="font-bold truncate">{slot.description}</div>
                            {slot.groupLabel && <div className="opacity-80 truncate">{slot.groupLabel}</div>}
                            {slot.room && <div className="opacity-70 truncate">{slot.room}</div>}
                            {slot.isHodShared && <div className="opacity-70 italic">All HoD</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
