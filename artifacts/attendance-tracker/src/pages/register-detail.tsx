import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useListCourses, useListStudents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Save, Send, Printer, Mail, ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const START_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
const STATUSES = ["P", "A", "L", "O", "E", "D"] as const;
type StatusCode = typeof STATUSES[number];

const STATUS_LABELS: Record<StatusCode, string> = {
  P: "Present", A: "Absent", L: "Late", O: "Other Authorised", E: "Excluded", D: "Distance Learning",
};
const STATUS_COLOURS: Record<StatusCode, string> = {
  P: "text-emerald-700 bg-emerald-50 border-emerald-200",
  A: "text-red-700 bg-red-50 border-red-200",
  L: "text-amber-700 bg-amber-50 border-amber-200",
  O: "text-blue-700 bg-blue-50 border-blue-200",
  E: "text-purple-700 bg-purple-50 border-purple-200",
  D: "text-slate-700 bg-slate-50 border-slate-200",
};

function InfoRow({ label, value, onClick }: { label: string; value?: string | number | null; onClick?: () => void }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-36 shrink-0 text-xs text-slate-500">{label}</span>
      {onClick ? (
        <button onClick={onClick} className="text-xs text-sky-700 hover:underline text-left">{value ?? "—"}</button>
      ) : (
        <span className="text-xs text-slate-900">{value ?? "—"}</span>
      )}
    </div>
  );
}

export default function RegisterDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const id = parseInt(params.id || "0", 10);
  const { data: courses, isLoading: isCoursesLoading } = useListCourses();
  const { data: students, isLoading: isStudentsLoading } = useListStudents();

  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [activeLink, setActiveLink] = useState("Session Summary");
  const [markings, setMarkings] = useState<Record<number, StatusCode>>({});
  const [minutesLate, setMinutesLate] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string>>({});

  const course = courses?.find(c => c.id === id);
  const startTime = START_TIMES[id % START_TIMES.length];
  const [startH] = startTime.split(":").map(Number);
  const endTime = `${String(startH + 1).padStart(2, "0")}:00`;
  const dayOfWeek = DAYS[id % DAYS.length];
  const eventCode = course ? `${course.code}-${new Date().getFullYear().toString().slice(2)}-${id}` : "";
  const registerStudents = (students ?? []).slice(0, Math.min(15, course?.enrolledCount ?? 10));
  const absentStudents = registerStudents.filter(s => markings[s.id] === "A");

  function setMark(studentId: number, val: StatusCode) {
    setMarkings(prev => ({ ...prev, [studentId]: val }));
    setSaved(false); setSubmitted(false);
  }

  function handleSave() { setSaved(true); }

  function handleSubmitFinal() {
    if (!saved) setSaved(true);
    setSubmitted(true);
  }

  function handleEmailAbsent() {
    setShowEmailPanel(true);
  }

  function handleSendEmails() {
    setEmailSent(true);
    setTimeout(() => { setShowEmailPanel(false); setEmailSent(false); }, 2500);
  }

  if (isCoursesLoading || isStudentsLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (!course) {
    return <div className="p-12 text-center text-muted-foreground">Register not found.</div>;
  }

  const REGISTER_LINKS = [
    { label: "Session Summary", action: () => setActiveLink("Session Summary") },
    { label: "View Full Course", action: () => navigate(`/courses/${course.id}`) },
    { label: "Previous Session", action: () => id > 1 && navigate(`/registers/${id - 1}`) },
    { label: "Next Session", action: () => navigate(`/registers/${id + 1}`) },
    { label: "Lesson Plan", action: () => setActiveLink("Lesson Plan") },
    { label: "Register Audit", action: () => setActiveLink("Register Audit") },
  ];

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      {/* ── Left Links Pane ── */}
      <div className="w-44 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Register Links</p>
        </div>
        {REGISTER_LINKS.map(({ label, action }) => (
          <button
            key={label}
            onClick={action}
            className={`w-full text-left text-xs px-4 py-2 border-b border-slate-100 transition-colors flex items-center gap-1.5 ${
              activeLink === label && !["View Full Course", "Previous Session", "Next Session"].includes(label)
                ? "bg-teal-700 text-white font-semibold"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {label === "Previous Session" && <ChevronLeft className="w-3 h-3 shrink-0" />}
            {label === "Next Session" && <ChevronRight className="w-3 h-3 shrink-0" />}
            {label}
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
                onClick={handleSave}
                disabled={submitted}
                className="flex items-center gap-1.5 text-xs bg-teal-700 text-white rounded px-2.5 py-1 hover:bg-teal-800 disabled:opacity-50"
              >
                <Save className="w-3 h-3" /> Save Register
              </button>
              <button
                onClick={handleSubmitFinal}
                disabled={submitted}
                className="flex items-center gap-1.5 text-xs bg-slate-700 text-white rounded px-2.5 py-1 hover:bg-slate-800 disabled:opacity-50"
              >
                <Send className="w-3 h-3" /> {submitted ? "Submitted ✓" : "Submit Final"}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Printer className="w-3 h-3" /> Print Register
              </button>
              <button
                onClick={handleEmailAbsent}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Mail className="w-3 h-3" /> Email Absent
              </button>
            </div>
          </div>

          {/* Status banners */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {saved && !submitted && (
              <div className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded">
                <Check className="w-3 h-3" /> Register saved successfully.
              </div>
            )}
            {submitted && (
              <div className="inline-flex items-center gap-1.5 bg-slate-700 text-white text-xs font-semibold px-3 py-1 rounded">
                <Check className="w-3 h-3" /> Register submitted and locked.
              </div>
            )}
          </div>

          {/* Email Absent panel */}
          {showEmailPanel && (
            <div className="mt-3 border border-slate-200 rounded bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">
                  Email parents / guardians of absent students ({absentStudents.length})
                </p>
                <button onClick={() => setShowEmailPanel(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
              </div>
              {absentStudents.length === 0 ? (
                <p className="text-xs text-slate-400">No absent students marked yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {absentStudents.map(s => (
                    <span key={s.id} className="text-xs bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">
                      {s.forename} {s.surname}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSendEmails}
                  disabled={absentStudents.length === 0 || emailSent}
                  className="flex items-center gap-1 text-xs bg-teal-700 text-white rounded px-3 py-1 hover:bg-teal-800 disabled:opacity-50"
                >
                  <Mail className="w-3 h-3" /> {emailSent ? "Sent!" : `Send ${absentStudents.length} Email${absentStudents.length !== 1 ? "s" : ""}`}
                </button>
                <button onClick={() => setShowEmailPanel(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 p-5 space-y-4">
          {/* Session Details */}
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Session Details</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-x-12">
              <div className="space-y-1">
                <InfoRow label="Register Reference" value={eventCode} />
                <InfoRow label="Session Date" value={new Date().toLocaleDateString("en-GB")} />
                <InfoRow label="Day" value={dayOfWeek} />
                <InfoRow label="Start Time" value={startTime} />
                <InfoRow label="End Time" value={endTime} />
                <InfoRow label="Room" value={course.room} />
              </div>
              <div className="space-y-1">
                <InfoRow label="Lecturer" value={course.staffName} onClick={course.staffName ? () => navigate(`/staff/0`) : undefined} />
                <InfoRow label="Subject / Module" value={course.name} />
                <InfoRow label="Course Code" value={course.code} />
                <InfoRow label="Register Status" value={submitted ? "Submitted (Final)" : saved ? "Marked" : "Open"} />
                <InfoRow label="No. of Students" value={registerStudents.length} />
                <InfoRow label="Event Type" value="Class" />
              </div>
            </div>
          </div>

          {/* Lesson Plan panel */}
          {activeLink === "Lesson Plan" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Lesson Plan</p>
              </div>
              <div className="px-5 py-4 text-xs text-slate-400">No lesson plan uploaded for this session. Add your data to populate this section.</div>
            </div>
          )}

          {/* Register Audit panel */}
          {activeLink === "Register Audit" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Register Audit Trail</p>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-100"><th className="text-left font-semibold text-slate-600 px-5 py-2">Date / Time</th><th className="text-left font-semibold text-slate-600 px-3 py-2">User</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Action</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Details</th></tr></thead>
                <tbody>
                  {saved ? (
                    <tr className="hover:bg-slate-50">
                      <td className="px-5 py-2 text-slate-600">{new Date().toLocaleString("en-GB")}</td>
                      <td className="px-3 py-2 text-slate-600">Current User</td>
                      <td className="px-3 py-2 text-slate-600">{submitted ? "Register Submitted (Final)" : "Register Saved"}</td>
                      <td className="px-3 py-2 text-slate-500">{eventCode}</td>
                    </tr>
                  ) : (
                    <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400">No audit entries yet. Save the register to create an entry.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Attendance marking table */}
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Attendance Marking — {registerStudents.length} Students
              </p>
              <div className="flex flex-wrap gap-1.5">
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
                      <input
                        type="checkbox"
                        disabled={submitted}
                        onChange={e => {
                          if (e.target.checked) {
                            const all: Record<number, StatusCode> = {};
                            registerStudents.forEach(s => { all[s.id] = "P"; });
                            setMarkings(all);
                          } else setMarkings({});
                          setSaved(false); setSubmitted(false);
                        }}
                      />
                    </th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Learner Name</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">ID / Ref</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2 w-40">Status</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2 w-24">Mins Late</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Comments / Notes</th>
                    <th className="text-center font-semibold text-slate-600 px-3 py-2 w-8">⚠</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registerStudents.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No students enrolled on this register.</td></tr>
                  ) : registerStudents.map(s => {
                    const mark = markings[s.id];
                    return (
                      <tr key={s.id} className={`hover:bg-slate-50 ${mark === "A" ? "bg-red-50" : mark === "L" ? "bg-amber-50" : ""}`}>
                        <td className="px-4 py-1.5">
                          <input type="checkbox" disabled={submitted} checked={!!mark}
                            onChange={e => {
                              if (e.target.checked) setMark(s.id, "P");
                              else { setMarkings(prev => { const n = { ...prev }; delete n[s.id]; return n; }); }
                            }}
                          />
                        </td>
                        <td className="px-3 py-1.5 font-medium text-slate-800">{s.forename} {s.surname}</td>
                        <td className="px-3 py-1.5 text-slate-500">{s.personCode}</td>
                        <td className="px-3 py-1.5">
                          <Select value={mark ?? ""} onValueChange={v => !submitted && setMark(s.id, v as StatusCode)} disabled={submitted}>
                            <SelectTrigger className={`h-6 text-xs px-2 font-bold border ${mark ? STATUS_COLOURS[mark] : "border-slate-300"}`}>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map(code => (
                                <SelectItem key={code} value={code} className="text-xs">{code} — {STATUS_LABELS[code]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" min={0} max={60} value={minutesLate[s.id] ?? ""} disabled={submitted || mark !== "L"}
                            onChange={e => { setMinutesLate(prev => ({ ...prev, [s.id]: e.target.value })); setSaved(false); }}
                            className="w-16 border border-slate-300 rounded text-xs px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-40 disabled:bg-slate-50"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="text" value={comments[s.id] ?? ""} disabled={submitted}
                            onChange={e => { setComments(prev => ({ ...prev, [s.id]: e.target.value })); setSaved(false); }}
                            className="w-full border border-slate-300 rounded text-xs px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-40 disabled:bg-slate-50"
                            placeholder="Add note…"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {s.atRisk && <AlertTriangle className="w-3.5 h-3.5 text-red-500 mx-auto" aria-label="At Risk" />}
                        </td>
                      </tr>
                    );
                  })}
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

          {/* Absent students panel */}
          {absentStudents.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded px-4 py-3">
              <p className="text-xs font-semibold text-red-700 mb-2">Absent Students ({absentStudents.length})</p>
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
