import { useState } from "react";
import { useParams } from "wouter";
import { useListCourses, useListStudents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Save, Send, Printer, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const START_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
const STATUSES = ["P", "A", "L", "O", "E", "D"] as const;
type StatusCode = typeof STATUSES[number];

const STATUS_LABELS: Record<StatusCode, string> = {
  P: "Present",
  A: "Absent",
  L: "Late",
  O: "Other Authorised",
  E: "Excluded",
  D: "Distance Learning",
};

const STATUS_COLOURS: Record<StatusCode, string> = {
  P: "text-emerald-700 bg-emerald-50 border-emerald-200",
  A: "text-red-700 bg-red-50 border-red-200",
  L: "text-amber-700 bg-amber-50 border-amber-200",
  O: "text-blue-700 bg-blue-50 border-blue-200",
  E: "text-purple-700 bg-purple-50 border-purple-200",
  D: "text-slate-700 bg-slate-50 border-slate-200",
};

const REGISTER_LINKS = [
  "Session Summary",
  "View Full Course",
  "Previous Session",
  "Next Session",
  "Lesson Plan",
  "Register Audit",
];

function InfoRow({ label, value, link = false }: { label: string; value?: string | number | null; link?: boolean }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-36 shrink-0 text-xs text-slate-500">{label}</span>
      {link ? (
        <span className="text-xs text-sky-700 hover:underline cursor-pointer">{value ?? "—"}</span>
      ) : (
        <span className="text-xs text-slate-900">{value ?? "—"}</span>
      )}
    </div>
  );
}

export default function RegisterDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: courses, isLoading: isCoursesLoading } = useListCourses();
  const { data: students, isLoading: isStudentsLoading } = useListStudents();
  const [activeLink, setActiveLink] = useState("Session Summary");
  const [saved, setSaved] = useState(false);

  const course = courses?.find(c => c.id === id);

  const startTime = START_TIMES[id % START_TIMES.length];
  const [startH, startM] = startTime.split(":").map(Number);
  const endTime = `${String(startH + 1).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
  const dayOfWeek = DAYS[id % DAYS.length];
  const eventCode = course ? `${course.code}-${new Date().getFullYear().toString().slice(2)}-${id}` : "";

  const registerStudents = (students ?? []).slice(0, Math.min(15, course?.enrolledCount ?? 10));

  const [markings, setMarkings] = useState<Record<number, StatusCode>>({});
  const [minutesLate, setMinutesLate] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string>>({});

  function setMark(studentId: number, val: StatusCode) {
    setMarkings(prev => ({ ...prev, [studentId]: val }));
    setSaved(false);
  }

  if (isCoursesLoading || isStudentsLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!course) {
    return <div className="p-12 text-center text-muted-foreground">Register not found.</div>;
  }

  const absentStudents = registerStudents.filter(s => markings[s.id] === "A");

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      {/* ── Left Links Pane ── */}
      <div className="w-44 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Register Links</p>
        </div>
        {REGISTER_LINKS.map(item => (
          <button
            key={item}
            onClick={() => setActiveLink(item)}
            className={`w-full text-left text-xs px-4 py-2 border-b border-slate-100 transition-colors flex items-center gap-1.5 ${
              activeLink === item
                ? "bg-teal-700 text-white font-semibold"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item === "Previous Session" && <ChevronLeft className="w-3 h-3 shrink-0" />}
            {item === "Next Session" && <ChevronRight className="w-3 h-3 shrink-0" />}
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
              <h1 className="text-base font-bold text-slate-800">Register Details</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {course.name} ({eventCode}) &nbsp;|&nbsp; {dayOfWeek} {startTime}–{endTime} &nbsp;|&nbsp; Room: {course.room ?? "—"}
              </p>
            </div>
            <div className="flex gap-2 shrink-0 ml-4 flex-wrap justify-end">
              <button
                onClick={() => setSaved(true)}
                className="flex items-center gap-1.5 text-xs bg-teal-700 text-white rounded px-2.5 py-1 hover:bg-teal-800"
              >
                <Save className="w-3 h-3" /> Save Register
              </button>
              <button className="flex items-center gap-1.5 text-xs bg-slate-700 text-white rounded px-2.5 py-1 hover:bg-slate-800">
                <Send className="w-3 h-3" /> Submit Final
              </button>
              <button className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50">
                <Printer className="w-3 h-3" /> Print Register
              </button>
              <button className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50">
                <Mail className="w-3 h-3" /> Email Absent
              </button>
            </div>
          </div>
          {saved && (
            <div className="mt-2 inline-flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded">
              Register saved successfully.
            </div>
          )}
        </div>

        <div className="flex-1 p-5 space-y-4">
          {/* Register header info */}
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Session Details</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-x-12">
              <div className="space-y-1">
                <InfoRow label="Register Reference" value={eventCode} />
                <InfoRow label="Session Date" value={new Date().toLocaleDateString("en-GB")} />
                <InfoRow label="Start Time" value={startTime} />
                <InfoRow label="End Time" value={endTime} />
                <InfoRow label="Room" value={course.room} />
              </div>
              <div className="space-y-1">
                <InfoRow label="Lecturer" value={course.staffName} link />
                <InfoRow label="Subject / Module" value={course.name} />
                <InfoRow label="Course Code" value={course.code} />
                <InfoRow label="Register Status" value={saved ? "Marked" : "Open"} />
                <InfoRow label="No. of Students" value={registerStudents.length} />
              </div>
            </div>
          </div>

          {/* Attendance marking table */}
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Attendance Marking — {registerStudents.length} Students
              </p>
              <div className="flex gap-2 text-xs text-slate-500">
                {STATUSES.map(s => (
                  <span key={s} className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${STATUS_COLOURS[s]}`}>
                    {s} = {STATUS_LABELS[s]}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left font-semibold text-slate-600 px-4 py-2 w-8">
                      <input type="checkbox" className="rounded" onChange={e => {
                        if (e.target.checked) {
                          const all: Record<number, StatusCode> = {};
                          registerStudents.forEach(s => { all[s.id] = "P"; });
                          setMarkings(all);
                        } else {
                          setMarkings({});
                        }
                        setSaved(false);
                      }} />
                    </th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Learner Name</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">ID / Ref</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2 w-36">Status</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2 w-24">Mins Late</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Comments / Notes</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2 w-8">⚠</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registerStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-400">No students enrolled on this register.</td>
                    </tr>
                  ) : (
                    registerStudents.map(s => {
                      const mark = markings[s.id];
                      return (
                        <tr key={s.id} className={`hover:bg-slate-50 ${mark === "A" ? "bg-red-50" : mark === "L" ? "bg-amber-50" : ""}`}>
                          <td className="px-4 py-1.5">
                            <input type="checkbox" className="rounded" checked={!!mark} onChange={e => {
                              if (e.target.checked) setMark(s.id, "P");
                              else { setMarkings(prev => { const n = { ...prev }; delete n[s.id]; return n; }); setSaved(false); }
                            }} />
                          </td>
                          <td className="px-3 py-1.5 font-medium text-slate-800">
                            {s.forename} {s.surname}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500">{s.personCode}</td>
                          <td className="px-3 py-1.5">
                            <Select value={mark ?? ""} onValueChange={v => setMark(s.id, v as StatusCode)}>
                              <SelectTrigger className={`h-6 text-xs px-2 font-bold border ${mark ? STATUS_COLOURS[mark] : "border-slate-300"}`}>
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map(code => (
                                  <SelectItem key={code} value={code} className="text-xs">
                                    {code} — {STATUS_LABELS[code]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min={0}
                              max={60}
                              value={minutesLate[s.id] ?? ""}
                              onChange={e => { setMinutesLate(prev => ({ ...prev, [s.id]: e.target.value })); setSaved(false); }}
                              className="w-16 border border-slate-300 rounded text-xs px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal-400"
                              placeholder="0"
                              disabled={mark !== "L"}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={comments[s.id] ?? ""}
                              onChange={e => { setComments(prev => ({ ...prev, [s.id]: e.target.value })); setSaved(false); }}
                              className="w-full border border-slate-300 rounded text-xs px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal-400"
                              placeholder="Add note…"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {s.atRisk && <AlertTriangle className="w-3.5 h-3.5 text-red-500" aria-label="At Risk" />}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary footer */}
            <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-6 text-xs text-slate-600">
              <span>Total: <strong>{registerStudents.length}</strong></span>
              <span className="text-emerald-700">Present: <strong>{Object.values(markings).filter(v => v === "P").length}</strong></span>
              <span className="text-red-700">Absent: <strong>{Object.values(markings).filter(v => v === "A").length}</strong></span>
              <span className="text-amber-700">Late: <strong>{Object.values(markings).filter(v => v === "L").length}</strong></span>
              <span className="text-blue-700">Other: <strong>{Object.values(markings).filter(v => !["P","A","L"].includes(v)).length}</strong></span>
              <span className="text-slate-400 ml-auto">Unmarked: <strong>{registerStudents.length - Object.keys(markings).length}</strong></span>
            </div>
          </div>

          {/* Absent students note */}
          {absentStudents.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded px-4 py-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Absent Students ({absentStudents.length})</p>
              <div className="flex flex-wrap gap-2">
                {absentStudents.map(s => (
                  <span key={s.id} className="text-xs text-red-700 bg-red-100 border border-red-200 rounded px-2 py-0.5">
                    {s.forename} {s.surname}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
