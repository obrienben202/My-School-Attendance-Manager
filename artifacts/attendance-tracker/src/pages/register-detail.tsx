import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetTodaySchedule,
  useGetAttendanceRegisterState,
  useListAttendanceRecords,
  useListAttendanceRegisterAudit,
  useListAttendanceRegisterContacts,
  useListAttendanceRegisterRoster,
  useListCourses,
  useReopenAttendanceRegister,
  useSubmitAttendanceRegister,
  type AttendanceRecord,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Save, Send, Printer, Mail, ChevronLeft, ChevronRight,
  X, Check, ChevronsDown, Edit, Info,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  STATUS_TO_API,
  statusFromApi,
  type RegisterStatusCode as StatusCode,
} from "@/lib/register-status";
import { trackEvent } from "@/lib/analytics";
import { formatDateOnly, toLocalDateOnlyValue } from "@/lib/date-only";

const STATUSES = ["P", "A", "L", "O", "E", "D", "N"] as const;
const EMPTY_ATTENDANCE: AttendanceRecord[] = [];

function getLocalDate() {
  return toLocalDateOnlyValue();
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
  const {
    data: schedule = [],
    isLoading: isScheduleLoading,
    isError: isScheduleError,
    refetch: refetchSchedule,
  } = useGetTodaySchedule({
    request: { cache: "no-store" },
  });

  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);  // editing a submitted register
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailPrepared, setEmailPrepared] = useState(false);
  const [activeLink, setActiveLink] = useState("Session Summary");
  const [markings, setMarkings] = useState<Record<number, StatusCode>>({});
  const [minutesLate, setMinutesLate] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [preserveOnFill, setPreserveOnFill] = useState(true);
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const scheduleEntry = schedule.find((entry) => entry.id === id);
  const requestedDate = new URLSearchParams(window.location.search).get("date");
  const sessionDate = requestedDate || scheduleEntry?.occurrenceDate || getLocalDate();
  const chronologicalOccurrences = useMemo(
    () => schedule
      .filter(entry => entry.courseId === scheduleEntry?.courseId)
      .sort((left, right) => {
        const leftKey = `${left.occurrenceDate}T${left.startTime}`;
        const rightKey = `${right.occurrenceDate}T${right.startTime}`;
        return leftKey.localeCompare(rightKey) || left.id - right.id;
      }),
    [schedule, scheduleEntry?.courseId],
  );
  const occurrenceIndex = chronologicalOccurrences.findIndex(
    entry => entry.id === id && entry.occurrenceDate === sessionDate,
  );
  const previousOccurrence = occurrenceIndex > 0
    ? chronologicalOccurrences[occurrenceIndex - 1]
    : undefined;
  const nextOccurrence = occurrenceIndex >= 0 && occurrenceIndex < chronologicalOccurrences.length - 1
    ? chronologicalOccurrences[occurrenceIndex + 1]
    : undefined;
  const course = courses?.find((c) => c.id === scheduleEntry?.courseId);
  const {
    data: attendance = EMPTY_ATTENDANCE,
    isLoading: isAttendanceLoading,
    isError: isAttendanceError,
    refetch: refetchAttendance,
  } = useListAttendanceRecords(
    { scheduleId: id, date: sessionDate },
    { query: { enabled: id > 0 && !!scheduleEntry } as any },
  );
  const {
    data: auditEntries = [],
    isLoading: isAuditLoading,
    isError: isAuditError,
    refetch: refetchAudit,
  } = useListAttendanceRegisterAudit(
    { scheduleId: id, date: sessionDate },
    { query: { enabled: id > 0 && !!scheduleEntry } as any },
  );
  const {
    data: registerState,
    isLoading: isRegisterStateLoading,
    isError: isRegisterStateError,
    refetch: refetchRegisterState,
  } = useGetAttendanceRegisterState(
    { scheduleId: id, date: sessionDate },
    { query: { enabled: id > 0 && !!scheduleEntry } as any },
  );
  const { data: registerContacts = [] } = useListAttendanceRegisterContacts(
    { scheduleId: id, date: sessionDate },
    { query: { enabled: id > 0 && !!scheduleEntry } as any },
  );
  const submitAttendance = useSubmitAttendanceRegister();
  const reopenAttendance = useReopenAttendanceRegister();
  const {
    data: registerStudents = [],
    isLoading: isRosterLoading,
    isError: isRosterError,
  } = useListAttendanceRegisterRoster(
    { scheduleId: id, date: sessionDate },
    { query: { enabled: id > 0 && !!scheduleEntry } as any },
  );
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
  const contactEmailByStudent = new Map(
    registerContacts.map(contact => [contact.studentId, contact.contactEmail]),
  );
  const absentRecipients = Array.from(new Set(
    absentStudents
      .map(student => contactEmailByStudent.get(student.id)?.trim())
      .filter((email): email is string => Boolean(email)),
  ));
  const absentWithoutEmail = absentStudents.filter(
    student => !contactEmailByStudent.get(student.id)?.trim(),
  );

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
    const nextMinutesLate: Record<number, string> = {};
    existingAttendance.forEach((record) => {
      nextMarkings[record.studentId] = statusFromApi(record.status);
      if (record.notes) nextComments[record.studentId] = record.notes;
      if (record.minutesLate !== null && record.minutesLate !== undefined) {
        nextMinutesLate[record.studentId] = String(record.minutesLate);
      }
    });
    setMarkings(nextMarkings);
    setComments(nextComments);
    setMinutesLate(nextMinutesLate);
  }, [existingAttendance, isAttendanceLoading]);

  useEffect(() => {
    if (!registerState) return;
    setSubmitted(registerState.status === "submitted");
    setSaved(registerState.status !== "open");
    setEditing(false);
  }, [registerState]);

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

  async function persistRegister(status: "draft" | "submitted") {
    if (!scheduleEntry) return false;

    setIsPersisting(true);
    setPersistenceError(null);
    try {
      const marks = registerStudents.flatMap((student) => {
        const mark = markings[student.id];
        const apiStatus = mark ? STATUS_TO_API[mark] : undefined;
        if (!apiStatus) return [];
        const notes = comments[student.id]?.trim();
        const lateMinutes = mark === "L" && minutesLate[student.id] !== undefined
          ? Number(minutesLate[student.id])
          : undefined;
        return [{
          studentId: student.id,
          status: apiStatus,
          ...(Number.isFinite(lateMinutes) ? { minutesLate: lateMinutes } : {}),
          ...(notes ? { notes } : {}),
        }];
      });

      await submitAttendance.mutateAsync({
        data: { scheduleId: id, date: sessionDate, status, marks },
      });
      await Promise.all([
        refetchAttendance(),
        refetchSchedule(),
        refetchAudit(),
        refetchRegisterState(),
      ]);
      return true;
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : "The register could not be saved.");
      return false;
    } finally {
      setIsPersisting(false);
    }
  }

  async function handleSave() {
    if (!scheduleEntry) return;
    const courseId = scheduleEntry.courseId;
    if (await persistRegister("draft")) {
      trackEvent("attendance_register_draft_saved", {
        location: "/registers/:id",
        schedule_id: id,
        course_id: courseId,
        occurrence_at: `${sessionDate}T00:00:00.000Z`,
        has_unmarked_marks: unmarked > 0,
      });
      setSaved(true);
      setSubmitted(false);
      setEditing(false);
    }
  }

  async function handleSubmitFinal() {
    if (!scheduleEntry) return;
    const courseId = scheduleEntry.courseId;
    if (!(await persistRegister("submitted"))) return;
    trackEvent("attendance_register_submitted", {
      location: "/registers/:id",
      schedule_id: id,
      course_id: courseId,
      occurrence_at: `${sessionDate}T00:00:00.000Z`,
      has_unmarked_marks: unmarked > 0,
    });
    setSaved(true);
    setSubmitted(true);
    setEditing(false);
    setShowSubmitConfirm(false);
  }

  async function handleEditRegister() {
    setPersistenceError(null);
    try {
      await reopenAttendance.mutateAsync({
        data: { scheduleId: id, date: sessionDate },
      });
      await Promise.all([refetchSchedule(), refetchAudit(), refetchRegisterState()]);
      setSubmitted(false);
      setSaved(true);
      setEditing(true);
      setShowEditConfirm(false);
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : "The register could not be reopened.");
    }
  }

  function handlePrepareEmail() {
    if (absentRecipients.length === 0) return;
    const subject = `Attendance follow-up: ${course?.code ?? "register"} on ${sessionDate}`;
    const body = [
      `This email concerns the following learner${absentStudents.length === 1 ? "" : "s"} marked absent from ${course?.name ?? "the session"} on ${sessionDate}:`,
      "",
      ...absentStudents.map(student => `- ${student.forename} ${student.surname}`),
      "",
      "Please review and personalise this message before sending.",
    ].join("\n");
    window.location.href = `mailto:?bcc=${encodeURIComponent(absentRecipients.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setEmailPrepared(true);
  }

  const REGISTER_LINKS = [
    { label: "Session Summary", action: () => setActiveLink("Session Summary") },
    { label: "View Full Course", action: () => navigate(`/courses/${course?.id ?? id}`) },
    {
      label: "Previous Session",
      disabled: !previousOccurrence,
      action: () => previousOccurrence && navigate(registerPath(
        previousOccurrence.id,
        previousOccurrence.occurrenceDate,
      )),
    },
    {
      label: "Next Session",
      disabled: !nextOccurrence,
      action: () => nextOccurrence && navigate(registerPath(
        nextOccurrence.id,
        nextOccurrence.occurrenceDate,
      )),
    },
    { label: "Register Audit", action: () => setActiveLink("Register Audit") },
    { label: "eRegisters List", action: () => navigate("/attendance") },
  ];

  const present = Object.values(markings).filter((v) => v === "P").length;
  const absent = Object.values(markings).filter((v) => v === "A").length;
  const late = Object.values(markings).filter((v) => v === "L").length;
  const other = Object.values(markings).filter((v) => !["P", "A", "L"].includes(v)).length;
  const unmarked = registerStudents.length - Object.keys(markings).length;

  if (
    isCoursesLoading ||
    isRosterLoading ||
    isScheduleLoading ||
    isAttendanceLoading ||
    isRegisterStateLoading
  ) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (isScheduleError || isRosterError || isAttendanceError || isRegisterStateError) {
    return (
      <div className="p-12 text-center">
        <p className="font-semibold text-red-700">This register could not be loaded</p>
        <p className="mt-1 text-sm text-slate-500">
          Check your connection and confirm that you are assigned to this lesson, then return to the eRegisters list and try again.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/attendance")}>
          Back to eRegisters
        </Button>
      </div>
    );
  }
  if (!course || !scheduleEntry) {
    return (
      <div className="p-12 text-center">
        <p className="font-semibold text-slate-700">Register unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This lesson does not exist, is inactive, or is not assigned to you.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/attendance")}>
          Back to eRegisters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      {/* ── Left Links Pane ── */}
      <div className="w-44 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Register Links</p>
        </div>
        {REGISTER_LINKS.map(({ label, action, disabled }) => (
          <button
            key={label}
            onClick={action}
            disabled={disabled}
            className={`w-full text-left text-xs px-4 py-2 border-b border-slate-100 transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white ${
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
                    disabled={isPersisting || registerStudents.length === 0}
                    className="flex items-center gap-1.5 text-xs bg-teal-700 text-white rounded px-2.5 py-1 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="w-3 h-3" /> {isPersisting ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    disabled={isPersisting || registerStudents.length === 0}
                    className="flex items-center gap-1.5 text-xs bg-slate-700 text-white rounded px-2.5 py-1 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="w-3 h-3" /> Submit
                  </button>
                </>
              )}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Printer className="w-3 h-3" /> Print
              </button>
              <button
                onClick={() => {
                  setEmailPrepared(false);
                  setShowEmailPanel(true);
                }}
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
                <Edit className="w-3 h-3" /> Register reopened as a draft — re-submit when corrections are complete.
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
                  Prepare email to absent learner contacts ({absentRecipients.length} address{absentRecipients.length === 1 ? "" : "es"})
                </p>
                <button onClick={() => setShowEmailPanel(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {absentStudents.length === 0 ? (
                <p className="text-xs text-slate-400">No absent students marked yet.</p>
              ) : (
                <div className="space-y-1">
                  {absentStudents.map((s) => (
                    <div key={s.id} className="text-xs text-slate-600">
                      <span className="font-medium">{s.forename} {s.surname}</span>
                      <span className="text-slate-400"> — {contactEmailByStudent.get(s.id) || "No contact email"}</span>
                    </div>
                  ))}
                </div>
              )}
              {absentWithoutEmail.length > 0 && (
                <p className="text-xs text-amber-700">
                  {absentWithoutEmail.length} absent learner{absentWithoutEmail.length === 1 ? " has" : "s have"} no contact email and will not be addressed.
                </p>
              )}
              {emailPrepared && (
                <p className="text-xs text-emerald-700">
                  The addressed draft was handed off to your email application. Review it there before sending.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handlePrepareEmail}
                  disabled={absentRecipients.length === 0}
                  className="flex items-center gap-1 text-xs bg-teal-700 text-white rounded px-3 py-1 hover:bg-teal-800 disabled:opacity-50"
                >
                  <Mail className="w-3 h-3" /> Prepare addressed email
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
                <InfoRow label="Session Date" value={formatDateOnly(sessionDate)} />
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
                  {isAuditLoading ? (
                    <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400">Loading audit history…</td></tr>
                  ) : isAuditError ? (
                    <tr><td colSpan={4} className="px-5 py-6 text-center text-red-600">The audit history could not be loaded.</td></tr>
                  ) : auditEntries.length > 0 ? (
                    auditEntries.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="px-5 py-2 text-slate-600">{new Date(entry.createdAt).toLocaleString("en-GB")}</td>
                        <td className="px-3 py-2 text-slate-600">{entry.actorName}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {entry.action === "submitted"
                            ? "Register Submitted (Final)"
                            : entry.action === "reopened"
                              ? "Register Reopened"
                              : "Draft Saved"}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{entry.details}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                        No audit entries yet. Save a draft or submit the register to create one.
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
                      <td colSpan={7} className="px-5 py-10 text-center">
                        <p className="font-semibold text-amber-700">No enrolled learners are available for this lesson</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Attendance cannot be saved until enrolments exist for {course.code}. Ask an administrator to check the course roster.
                        </p>
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
                                  setSaved(false);
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
            <DialogDescription>
              Confirm that this occurrence is ready to be finalised and locked.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Once submitted, the register will be <strong>locked</strong>. Use Edit Register to reopen it as a draft before making corrections.
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
            <DialogDescription>
              Reopen this submitted occurrence so its attendance marks can be corrected.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This register has already been submitted. Saving a correction will return it to draft status until you submit it again.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>Cancel</Button>
            <Button
              onClick={handleEditRegister}
              disabled={reopenAttendance.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {reopenAttendance.isPending ? "Reopening…" : "Edit Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
