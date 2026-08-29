import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTodaySchedule,
  useListAttendanceRecords,
  useListCourses,
  useSubmitAttendanceRegister,
  type AttendanceRecord,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Save, Send, Printer, Mail, ChevronLeft, ChevronRight,
  X, Check, ChevronsDown, Edit, KeyRound, Info,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["P", "A", "L", "O", "E", "D", "N"] as const;
type StatusCode = typeof STATUSES[number];
type ApiStatus = "present" | "absent" | "late" | "authorised" | "excluded" | "distance_learning";
type RegisterStudent = {
  id: number;
  personCode: string;
  forename: string;
  surname: string;
  atRisk: boolean;
};
const EMPTY_ATTENDANCE: AttendanceRecord[] = [];

const STATUS_TO_API: Partial<Record<StatusCode, ApiStatus>> = {
  P: "present",
  A: "absent",
  L: "late",
  O: "authorised",
  E: "excluded",
  D: "distance_learning",
};

const API_TO_STATUS: Record<ApiStatus, StatusCode> = {
  present: "P",
  absent: "A",
  late: "L",
  authorised: "O",
  excluded: "E",
  distance_learning: "D",
};

function getLocalDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

const STATUS_LABELS: Record<StatusCode, string> = {
  P: "Present", A: "Absent", L: "Late", O: "Other Authorised",
  E: "Excluded", D: "Distance Learning", N: "Not Yet Marked",
};
const STATUS_COLOURS: Record<StatusCode, string> = {
  P: "text-emerald-700 bg-emerald-50 border-emerald-200",
  A: "text-red-700 bg-red-50 border-red-200",
  L: "text-amber-700 bg-amber-50 border-amber-200",
  O: "text-blue-700 bg-blue-50 border-blue-200",
  E: "text-purple-700 bg-purple-50 border-purple-200",
  D: "text-slate-700 bg-slate-50 border-slate-200",
  N: "text-gray-500 bg-gray-50 border-gray-200",
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
  const staffContext = new URLSearchParams(window.location.search).get("staff");
  const { data: courses, isLoading: isCoursesLoading } = useListCourses();
  const { data: schedule = [], isLoading: isScheduleLoading } = useGetTodaySchedule();

  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);  // editing a submitted register
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [activeLink, setActiveLink] = useState("Session Summary");
  const [markings, setMarkings] = useState<Record<number, StatusCode>>({});
  const [minutesLate, setMinutesLate] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showPinPanel, setShowPinPanel] = useState(false);
  const [preserveOnFill, setPreserveOnFill] = useState(true);
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const scheduleEntry = schedule.find((entry) => entry.id === id);
  const scheduleIndex = schedule.findIndex((entry) => entry.id === id);
  const requestedDate = new URLSearchParams(window.location.search).get("date");
  const sessionDate = requestedDate || scheduleEntry?.occurrenceDate || getLocalDate();
  const course = courses?.find((c) => c.id === scheduleEntry?.courseId);
  const {
    data: attendance = EMPTY_ATTENDANCE,
    isLoading: isAttendanceLoading,
    refetch: refetchAttendance,
  } = useListAttendanceRecords(
    { scheduleId: id, date: sessionDate },
    { query: { enabled: id > 0 && !!scheduleEntry } as any },
  );
  const submitAttendance = useSubmitAttendanceRegister();
  const {
    data: registerStudents = [],
    isLoading: isRosterLoading,
    isError: isRosterError,
  } = useQuery<RegisterStudent[]>({
    queryKey: ["course-students", scheduleEntry?.courseId],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const response = await fetch(
        `${base}/api/courses/${scheduleEntry!.courseId}/students`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("The course roster could not be loaded.");
      return response.json();
    },
    enabled: scheduleEntry?.courseId !== undefined,
  });
  const startTime = scheduleEntry?.startTime ?? "";
  const endTime = scheduleEntry?.endTime ?? "";
  const dayOfWeek = scheduleEntry?.day ?? "Not provided";
  const eventCode = scheduleEntry
    ? `${scheduleEntry.courseCode}-${new Date().getFullYear().toString().slice(2)}-${String(id).padStart(4, "0")}`
    : "";
  const existingAttendance = useMemo(
    () => attendance.filter((record) => record.date === sessionDate),
    [attendance, sessionDate],
  );
  const absentStudents = registerStudents.filter((s) => markings[s.id] === "A");

  // Deterministic PIN for the session (4-digit)
  const sessionPin = useMemo(() => String((id * 7 + 1337) % 9000 + 1000), [id]);

  const isLocked = submitted && !editing;

  function registerPath(scheduleId: number, occurrenceDate: string) {
    const query = new URLSearchParams({ date: occurrenceDate });
    if (staffContext) query.set("staff", staffContext);
    return `/registers/${scheduleId}?${query.toString()}`;
  }

  useEffect(() => {
    if (isAttendanceLoading) return;

    const nextMarkings: Record<number, StatusCode> = {};
    const nextComments: Record<number, string> = {};
    existingAttendance.forEach((record) => {
      nextMarkings[record.studentId] = API_TO_STATUS[record.status as ApiStatus] ?? "N";
      if (record.notes) nextComments[record.studentId] = record.notes;
    });
    setMarkings(nextMarkings);
    setComments(nextComments);
    setSubmitted(existingAttendance.length > 0);
    setSaved(existingAttendance.length > 0);
  }, [existingAttendance, isAttendanceLoading]);

  function setMark(studentId: number, val: StatusCode) {
    if (isLocked) return;
    setMarkings((prev) => ({ ...prev, [studentId]: val }));
    setSaved(false);
  }

  function handleFillDown(fromStudentId: number, mark: StatusCode) {
    const fromIdx = registerStudents.findIndex((s) => s.id === fromStudentId);
    if (fromIdx < 0) return;
    setMarkings((prev) => {
      const next = { ...prev };
      registerStudents.slice(fromIdx + 1).forEach((s) => {
        if (!preserveOnFill || !next[s.id]) {
          next[s.id] = mark;
        }
      });
      return next;
    });
    setSaved(false);
  }

  function handleMarkAll(code: StatusCode) {
    const all: Record<number, StatusCode> = {};
    registerStudents.forEach((s) => { all[s.id] = code; });
    setMarkings(all);
    setSaved(false);
  }

  async function persistRegister() {
    if (!scheduleEntry) return false;

    setIsPersisting(true);
    setPersistenceError(null);
    try {
      const marks = registerStudents.flatMap((student) => {
        const mark = markings[student.id];
        const apiStatus = mark ? STATUS_TO_API[mark] : undefined;
        if (!apiStatus) return [];
        const notes = comments[student.id]?.trim();
        return [{
          studentId: student.id,
          status: apiStatus,
          ...(notes ? { notes } : {}),
        }];
      });

      await submitAttendance.mutateAsync({
        data: { scheduleId: id, date: sessionDate, marks },
      });
      await refetchAttendance();
      return true;
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : "The register could not be saved.");
      return false;
    } finally {
      setIsPersisting(false);
    }
  }

  async function handleSave() {
    if (await persistRegister()) setSaved(true);
  }

  async function handleSubmitFinal() {
    if (!(await persistRegister())) return;
    setSaved(true);
    setSubmitted(true);
    setEditing(false);
    setShowSubmitConfirm(false);
  }

  function handleEditRegister() {
    setEditing(true);
    setShowEditConfirm(false);
  }

  function handleSendEmails() {
    setEmailSent(true);
    setTimeout(() => { setShowEmailPanel(false); setEmailSent(false); }, 2500);
  }

  const REGISTER_LINKS = [
    { label: "Session Summary", action: () => setActiveLink("Session Summary") },
    { label: "View Full Course", action: () => navigate(`/courses/${course?.id ?? id}`) },
    {
      label: "Previous Session",
      action: () => scheduleIndex > 0 && navigate(registerPath(
        schedule[scheduleIndex - 1].id,
        schedule[scheduleIndex - 1].occurrenceDate,
      )),
    },
    {
      label: "Next Session",
      action: () => scheduleIndex >= 0 && scheduleIndex < schedule.length - 1 && navigate(registerPath(
        schedule[scheduleIndex + 1].id,
        schedule[scheduleIndex + 1].occurrenceDate,
      )),
    },
    { label: "Lesson Plan", action: () => setActiveLink("Lesson Plan") },
    { label: "Register Audit", action: () => setActiveLink("Register Audit") },
    { label: "eRegisters List", action: () => navigate("/attendance") },
  ];

  const present = Object.values(markings).filter((v) => v === "P").length;
  const absent = Object.values(markings).filter((v) => v === "A").length;
  const late = Object.values(markings).filter((v) => v === "L").length;
  const other = Object.values(markings).filter((v) => !["P", "A", "L"].includes(v)).length;
  const unmarked = registerStudents.length - Object.keys(markings).length;

  if (isCoursesLoading || isRosterLoading || isScheduleLoading || isAttendanceLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (isRosterError) {
    return <div className="p-12 text-center text-red-700">The course roster could not be loaded. Please try again.</div>;
  }
  if (!course || !scheduleEntry) {
    return <div className="p-12 text-center text-muted-foreground">Register not found.</div>;
  }

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
              activeLink === label && !["View Full Course", "Previous Session", "Next Session", "eRegisters List"].includes(label)
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
          {staffContext && (
            <button
              onClick={() => navigate(`/staff/${encodeURIComponent(staffContext)}/register-history`)}
              className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-700"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back to Register History
            </button>
          )}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-800">Mark Register</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {course.name} ({eventCode}) &nbsp;|&nbsp; {dayOfWeek} {startTime}–{endTime} &nbsp;|&nbsp; Room: {scheduleEntry.room ?? course.room ?? "—"}
              </p>
            </div>
            <div className="flex gap-2 shrink-0 ml-4 flex-wrap justify-end">
              {submitted && !editing ? (
                <button
                  onClick={() => setShowEditConfirm(true)}
                  className="flex items-center gap-1.5 text-xs bg-amber-600 text-white rounded px-2.5 py-1 hover:bg-amber-700"
                >
                  <Edit className="w-3 h-3" /> Edit Register
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isPersisting}
                    className="flex items-center gap-1.5 text-xs bg-teal-700 text-white rounded px-2.5 py-1 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="w-3 h-3" /> {isPersisting ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    disabled={isPersisting}
                    className="flex items-center gap-1.5 text-xs bg-slate-700 text-white rounded px-2.5 py-1 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="w-3 h-3" /> Submit
                  </button>
                </>
              )}
              <button
                onClick={() => setShowPinPanel(true)}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <KeyRound className="w-3 h-3" /> Show PIN
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Printer className="w-3 h-3" /> Print
              </button>
              <button
                onClick={() => setShowEmailPanel(true)}
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
            {submitted && !editing && (
              <div className="inline-flex items-center gap-1.5 bg-slate-700 text-white text-xs font-semibold px-3 py-1 rounded">
                <Check className="w-3 h-3" /> Register submitted and locked.
              </div>
            )}
            {editing && (
              <div className="inline-flex items-center gap-1.5 bg-amber-600 text-white text-xs font-semibold px-3 py-1 rounded">
                <Edit className="w-3 h-3" /> Editing submitted register — save and re-submit when done.
              </div>
            )}
            {persistenceError && (
              <div className="inline-flex items-center gap-1.5 border border-red-200 bg-red-50 text-red-700 text-xs font-semibold px-3 py-1 rounded">
                <AlertTriangle className="w-3 h-3" /> {persistenceError}
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
                <button onClick={() => setShowEmailPanel(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {absentStudents.length === 0 ? (
                <p className="text-xs text-slate-400">No absent students marked yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {absentStudents.map((s) => (
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
                <button onClick={() => setShowEmailPanel(false)} className="text-xs text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
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
                <InfoRow label="Session Date" value={new Date(`${sessionDate}T00:00:00`).toLocaleDateString("en-GB")} />
                <InfoRow label="Day" value={dayOfWeek} />
                <InfoRow label="Start Time" value={startTime} />
                <InfoRow label="End Time" value={endTime} />
                <InfoRow label="Room" value={scheduleEntry.room ?? course.room} />
              </div>
              <div className="space-y-1">
                <InfoRow
                  label="Lecturer"
                  value={course.staffName}
                  onClick={course.staffName && staffContext ? () => navigate(`/staff/${encodeURIComponent(staffContext)}`) : undefined}
                />
                <InfoRow label="Subject / Module" value={course.name} />
                <InfoRow label="Course Code" value={course.code} />
                <InfoRow
                  label="Register Status"
                  value={submitted && !editing ? "Submitted (Final)" : saved ? "Marked" : "Open"}
                />
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
              <div className="px-5 py-4 text-xs text-slate-400">
                No lesson plan uploaded for this session. Add your data to populate this section.
              </div>
            </div>
          )}

          {/* Register Audit panel */}
          {activeLink === "Register Audit" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Register Audit Trail</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left font-semibold text-slate-600 px-5 py-2">Date / Time</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">User</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Action</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {saved ? (
                    <tr className="hover:bg-slate-50">
                      <td className="px-5 py-2 text-slate-600">{new Date().toLocaleString("en-GB")}</td>
                      <td className="px-3 py-2 text-slate-600">Current User</td>
                      <td className="px-3 py-2 text-slate-600">
                        {submitted ? "Register Submitted (Final)" : "Register Saved"}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{eventCode}</td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                        No audit entries yet. Save the register to create an entry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Attendance marking table */}
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Attendance Marking — {registerStudents.length} Students
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Fill down settings */}
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preserveOnFill}
                    onChange={(e) => setPreserveOnFill(e.target.checked)}
                    className="rounded"
                  />
                  Preserve existing marks on Fill Down
                </label>
                {/* Quick mark all */}
                {!isLocked && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">Mark all:</span>
                    {(["P", "A"] as StatusCode[]).map((code) => (
                      <button
                        key={code}
                        onClick={() => handleMarkAll(code)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLOURS[code]}`}
                        title={`Mark all as ${STATUS_LABELS[code]}`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                )}
                {/* Legend */}
                <div className="flex flex-wrap gap-1">
                  {(["P", "A", "L", "O", "E", "D"] as StatusCode[]).map((s) => (
                    <span key={s} className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${STATUS_COLOURS[s]}`}>
                      {s} = {STATUS_LABELS[s]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left font-semibold text-slate-600 px-4 py-2 w-8">
                      <input
                        type="checkbox"
                        disabled={isLocked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const all: Record<number, StatusCode> = {};
                            registerStudents.forEach((s) => { all[s.id] = "P"; });
                            setMarkings(all);
                          } else setMarkings({});
                          setSaved(false);
                        }}
                      />
                    </th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Learner Name</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">ID / Ref</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2 w-52">Status</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2 w-24">Mins Late</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Comments / Notes</th>
                    <th className="text-center font-semibold text-slate-600 px-3 py-2 w-8">⚠</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registerStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                        No students enrolled on this register.
                      </td>
                    </tr>
                  ) : (
                    registerStudents.map((s, idx) => {
                      const mark = markings[s.id];
                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-slate-50 ${mark === "A" ? "bg-red-50" : mark === "L" ? "bg-amber-50/50" : ""}`}
                        >
                          <td className="px-4 py-1.5">
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={!!mark}
                              onChange={(e) => {
                                if (e.target.checked) setMark(s.id, "P");
                                else {
                                  setMarkings((prev) => {
                                    const n = { ...prev };
                                    delete n[s.id];
                                    return n;
                                  });
                                }
                              }}
                            />
                          </td>
                          <td className="px-3 py-1.5 font-medium text-slate-800">
                            {s.forename} {s.surname}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500 font-mono">{s.personCode}</td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <Select
                                value={mark ?? ""}
                                onValueChange={(v) => !isLocked && setMark(s.id, v as StatusCode)}
                                disabled={isLocked}
                              >
                                <SelectTrigger
                                  className={`h-6 text-xs px-2 font-bold border flex-1 ${mark ? STATUS_COLOURS[mark] : "border-slate-300"}`}
                                >
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(["P", "A", "L", "O", "E", "D"] as StatusCode[]).map((code) => (
                                    <SelectItem key={code} value={code} className="text-xs">
                                      {code} — {STATUS_LABELS[code]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {/* Fill Down button — only when a mark is set and not last row */}
                              {mark && idx < registerStudents.length - 1 && !isLocked && (
                                <button
                                  title="Fill Down from this row"
                                  onClick={() => handleFillDown(s.id, mark)}
                                  className="h-6 w-6 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-100 text-slate-500 shrink-0"
                                >
                                  <ChevronsDown size={11} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min={0}
                              max={60}
                              value={minutesLate[s.id] ?? ""}
                              disabled={isLocked || mark !== "L"}
                              onChange={(e) => {
                                setMinutesLate((prev) => ({ ...prev, [s.id]: e.target.value }));
                                setSaved(false);
                              }}
                              className="w-16 border border-slate-300 rounded text-xs px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-40 disabled:bg-slate-50"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={comments[s.id] ?? ""}
                              disabled={isLocked}
                              onChange={(e) => {
                                setComments((prev) => ({ ...prev, [s.id]: e.target.value }));
                                setSaved(false);
                              }}
                              className="w-full border border-slate-300 rounded text-xs px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-40 disabled:bg-slate-50"
                              placeholder="Add note…"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {s.atRisk && (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 mx-auto" aria-label="At Risk" />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Summary footer */}
            <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-6 text-xs text-slate-600 flex-wrap">
              <span>Total: <strong>{registerStudents.length}</strong></span>
              <span className="text-emerald-700">Present: <strong>{present}</strong></span>
              <span className="text-red-700">Absent: <strong>{absent}</strong></span>
              <span className="text-amber-700">Late: <strong>{late}</strong></span>
              <span className="text-blue-700">Other: <strong>{other}</strong></span>
              <span className="text-slate-400 ml-auto">Unmarked: <strong>{unmarked}</strong></span>
            </div>
          </div>

          {/* Absent students panel */}
          {absentStudents.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded px-4 py-3">
              <p className="text-xs font-semibold text-red-700 mb-2">Absent Students ({absentStudents.length})</p>
              <div className="flex flex-wrap gap-2">
                {absentStudents.map((s) => (
                  <span key={s.id} className="text-xs text-red-700 bg-red-100 border border-red-200 rounded px-2 py-0.5">
                    {s.forename} {s.surname}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* eRegister Details pane */}
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">eRegister Details</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-x-12 gap-y-1">
              <InfoRow label="Event Code" value={eventCode} />
              <InfoRow label="Attendance %" value={registerStudents.length > 0 ? `${Math.round((present / registerStudents.length) * 100)}%` : "—"} />
              <InfoRow label="Licence" value="EBS4Agent5eRegister" />
              <InfoRow label="Present" value={present} />
              <InfoRow label="Year Group" value={course.yearGroup ?? "Mixed"} />
              <InfoRow label="Absent" value={absent} />
              <InfoRow label="Session PIN" value={sessionPin} />
              <InfoRow label="Late" value={late} />
              <InfoRow label="Validate Empty Marks" value="N" />
              <InfoRow label="Unmarked" value={unmarked} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Submit Confirm ── */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit Register?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Once submitted, the register will be <strong>locked</strong>. You will need elevated permissions (Edit Marked Register role) to make further changes.
          </p>
          {unmarked > 0 && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 text-sm">
              <strong>{unmarked}</strong> student{unmarked !== 1 ? "s are" : " is"} still unmarked.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitFinal}
              disabled={isPersisting}
              className="bg-slate-700 hover:bg-slate-800"
            >
              {isPersisting ? "Submitting…" : "Submit Final"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Submitted Confirm ── */}
      <Dialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Submitted Register?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This register has already been submitted. Editing requires the <strong>Edit Marked Register</strong> role. Make your changes and re-submit when done.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>Cancel</Button>
            <Button onClick={handleEditRegister} className="bg-amber-600 hover:bg-amber-700">Edit Register</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Learner PIN ── */}
      <Dialog open={showPinPanel} onOpenChange={setShowPinPanel}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} /> Learner Self-Marking PIN
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="text-5xl font-bold font-mono text-teal-700 tracking-[0.3em] mb-3">{sessionPin}</div>
            <p className="text-sm text-gray-500">
              Share this PIN with learners. They can enter it on the <strong>Attendance Reporting</strong> screen in the Learner Hub to mark themselves as present for this session.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPinPanel(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
