import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetCourse, useListAttendanceRecords, useListStudents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, FileText, Download, Users, BookOpen, Clock, Layers, ClipboardList, UserCheck } from "lucide-react";

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

export default function CourseDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const id = parseInt(params.id || "0", 10);
  const [activeLink, setActiveLink] = useState("Enrolled Learners");

  const { data: course, isLoading } = useGetCourse(id, { query: { enabled: !!id } as any });
  const { data: attendance } = useListAttendanceRecords({ courseId: id }, { query: { enabled: !!id } as any });
  const { data: allStudents } = useListStudents();

  if (isLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (!course) {
    return <div className="p-12 text-center text-muted-foreground">Course not found.</div>;
  }

  const faculty = FACULTIES[id % FACULTIES.length];
  const level = LEVELS[id % LEVELS.length];
  const centuryId = `CTY-${String(id).padStart(4, "0")}`;
  const startTime = START_TIMES[id % START_TIMES.length];
  const [startH] = startTime.split(":").map(Number);
  const endTime = `${String(startH + 1).padStart(2, "0")}:00`;
  const dayOfWeek = DAYS[id % DAYS.length];

  const presentCount = attendance?.filter(a => a.status === "present").length ?? 0;
  const absentCount = attendance?.filter(a => a.status === "absent").length ?? 0;
  const lateCount = attendance?.filter(a => a.status === "late").length ?? 0;

  const enrolledStudents = (allStudents ?? []).slice(0, course.enrolledCount);

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
            onClick={() => setActiveLink(label)}
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
              <p className="text-xs text-slate-500 mt-0.5">Code: {course.code} &nbsp;|&nbsp; {level} &nbsp;|&nbsp; {faculty} &nbsp;|&nbsp; Status: Active</p>
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Download className="w-3 h-3" /> Export List
              </button>
              <button
                onClick={() => window.print()}
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
                    <InfoRow label="Academic Year" value="2024/25" />
                    <InfoRow label="Level" value={level} />
                    <InfoRow label="Faculty / Department" value={faculty} />
                  </div>
                  <div className="space-y-1">
                    <InfoRow label="Course Leader" value={course.staffName} />
                    <InfoRow label="Owning Organisation" value={faculty} />
                    <InfoRow label="Start Date" value="01/08/2024" />
                    <InfoRow label="End Date" value="31/07/2025" />
                    <InfoRow label="Status" value="Live / Published (ACTIVE)" />
                    <InfoRow label="Course Hours" value="180" />
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
                <Section title="Timetable Slots">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-100"><th className="text-left font-semibold text-slate-600 pb-2 pr-6">Day</th><th className="text-left font-semibold text-slate-600 pb-2 pr-6">Start Time</th><th className="text-left font-semibold text-slate-600 pb-2 pr-6">End Time</th><th className="text-left font-semibold text-slate-600 pb-2 pr-6">Room</th><th className="text-left font-semibold text-slate-600 pb-2">Week Pattern</th></tr></thead>
                    <tbody>
                      <tr className="hover:bg-slate-50">
                        <td className="py-1.5 pr-6 text-slate-700">{dayOfWeek}</td>
                        <td className="py-1.5 pr-6 text-slate-700">{startTime}</td>
                        <td className="py-1.5 pr-6 text-slate-700">{endTime}</td>
                        <td className="py-1.5 pr-6 text-slate-700">{course.room ?? "—"}</td>
                        <td className="py-1.5 text-slate-500">1–49, 51–52</td>
                      </tr>
                    </tbody>
                  </table>
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
                <Section title="Assessment Plan">
                  <p className="text-xs text-slate-400">No assessment plan on record. Add your data to populate this section.</p>
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
          <button key={r} onClick={() => window.print()} className="w-full text-left text-xs px-4 py-2 border-b border-slate-100 text-sky-700 hover:bg-sky-50 flex items-center gap-1.5 transition-colors">
            <FileText className="w-3 h-3 shrink-0 text-sky-500" />{r}
          </button>
        ))}
      </div>
    </div>
  );
}
