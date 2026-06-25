import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetStudent,
  useListAttendanceRecords,
  useListTargets,
  useListIlps,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, UserCircle2, Printer, Mail, Edit, PlusCircle, FileText } from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-36 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-900">{value || "—"}</span>
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
];

const CENTER_TABS = [
  "Summary",
  "Address",
  "Enrolments",
  "Attendance",
  "Performance",
  "ILP",
  "Pastoral",
  "Evidence",
  "Communication",
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
  const [activeLink, setActiveLink] = useState("Personal Details");
  const [activeTab, setActiveTab] = useState("Summary");

  const { data: student, isLoading: isStudentLoading } = useGetStudent(id, { query: { enabled: !!id } as any });
  const { data: attendance, isLoading: isAttendanceLoading } = useListAttendanceRecords({ studentId: id }, { query: { enabled: !!id } as any });
  const { data: targets, isLoading: isTargetsLoading } = useListTargets({ studentId: id }, { query: { enabled: !!id } as any });
  const { data: ilps, isLoading: isIlpsLoading } = useListIlps({ studentId: id }, { query: { enabled: !!id } as any });

  if (isStudentLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!student) {
    return <div className="p-12 text-center text-muted-foreground">Learner not found.</div>;
  }

  const fullName = [student.forename, student.middleNames, student.surname].filter(Boolean).join(" ");
  const dob = student.dateOfBirth || "—";
  const age = student.dateOfBirth
    ? Math.floor((Date.now() - new Date(student.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

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
            onClick={() => setActiveLink(item)}
            className={`w-full text-left text-xs px-4 py-2 border-b border-slate-100 transition-colors ${
              activeLink === item
                ? "bg-teal-700 text-white font-semibold"
                : "text-slate-700 hover:bg-slate-50"
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
            <div className="flex gap-2 shrink-0 ml-4">
              <button className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"><Edit className="w-3 h-3" /> Edit Details</button>
              <button className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"><PlusCircle className="w-3 h-3" /> Add Note</button>
              <button className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"><Mail className="w-3 h-3" /> Send Message</button>
              <button className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"><Printer className="w-3 h-3" /> Print Profile</button>
            </div>
          </div>

          {student.atRisk && (
            <div className="mt-2 inline-flex items-center gap-2 bg-red-600 text-white text-xs font-semibold px-3 py-1 rounded">
              <AlertTriangle className="w-3 h-3" /> At Risk — Requires Additional Support
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-0 mt-3 -mb-3">
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
        </div>

        {/* Tab content */}
        <div className="flex-1 p-5">
          {activeTab === "Summary" && (
            <div className="space-y-4">
              {/* Photo + identity */}
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

              {/* Attendance card */}
              <div className="bg-white border border-slate-200 rounded">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Attendance</p>
                </div>
                <div className="px-5 py-4 grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-slate-500">Current Year Attendance</p>
                    <p className={`text-2xl font-bold mt-1 ${student.attendancePercent < 90 ? "text-red-600" : "text-emerald-600"}`}>
                      {student.attendancePercent}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Cumulative Attendance</p>
                    <p className={`text-2xl font-bold mt-1 ${student.attendancePercent < 90 ? "text-red-600" : "text-emerald-600"}`}>
                      {Math.round(student.attendancePercent * 0.97)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Punctuality</p>
                    <p className={`text-2xl font-bold mt-1 ${student.punctualityPercent < 95 ? "text-amber-500" : "text-emerald-600"}`}>
                      {student.punctualityPercent}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Confirmed Learner</p>
                    <p className="text-sm font-semibold mt-2 text-slate-800">{student.confirmedLearner ? "Yes" : "No"}</p>
                  </div>
                </div>
              </div>

              {/* Course summary card */}
              <div className="bg-white border border-slate-200 rounded">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Course Summary</p>
                </div>
                {isAttendanceLoading ? (
                  <div className="px-5 py-4"><Skeleton className="h-16 w-full" /></div>
                ) : attendance?.length ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left font-semibold text-slate-600 px-5 py-2">Course Name</th>
                        <th className="text-left font-semibold text-slate-600 px-3 py-2">Date</th>
                        <th className="text-left font-semibold text-slate-600 px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {attendance.slice(0, 5).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-5 py-1.5 text-sky-700">{r.courseName}</td>
                          <td className="px-3 py-1.5 text-slate-500">{r.date}</td>
                          <td className="px-3 py-1.5">
                            <span className={`font-semibold capitalize ${
                              r.status === "present" ? "text-emerald-600" :
                              r.status === "absent" ? "text-red-600" :
                              r.status === "late" ? "text-amber-600" : "text-blue-600"
                            }`}>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-5 py-4 text-xs text-slate-400">No course records.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "Address" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Address Details</p>
              </div>
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

          {activeTab === "Enrolments" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Enrolments</p>
              </div>
              <div className="px-5 py-4 text-xs text-slate-400">No enrolment records on file.</div>
            </div>
          )}

          {activeTab === "Attendance" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Attendance History</p>
              </div>
              {isAttendanceLoading ? (
                <div className="px-5 py-4"><Skeleton className="h-32 w-full" /></div>
              ) : attendance?.length ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left font-semibold text-slate-600 px-5 py-2">Course</th>
                      <th className="text-left font-semibold text-slate-600 px-3 py-2">Date</th>
                      <th className="text-left font-semibold text-slate-600 px-3 py-2">Status</th>
                      <th className="text-left font-semibold text-slate-600 px-3 py-2">Minutes Late</th>
                      <th className="text-left font-semibold text-slate-600 px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {attendance.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-5 py-1.5 text-sky-700">{r.courseName}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.date}</td>
                        <td className="px-3 py-1.5">
                          <span className={`font-semibold capitalize ${
                            r.status === "present" ? "text-emerald-600" :
                            r.status === "absent" ? "text-red-600" :
                            r.status === "late" ? "text-amber-600" : "text-blue-600"
                          }`}>{r.status}</span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-500">{r.minutesLate ?? 0}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-5 py-4 text-xs text-slate-400">No attendance records.</div>
              )}
            </div>
          )}

          {activeTab === "Performance" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Performance / SMART Targets</p>
              </div>
              {isTargetsLoading ? (
                <div className="px-5 py-4"><Skeleton className="h-24 w-full" /></div>
              ) : targets?.length ? (
                <div className="px-5 py-4 space-y-3">
                  {targets.map(t => (
                    <div key={t.id} className="border border-slate-200 rounded p-3">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-xs text-slate-800">{t.title}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          t.completed ? "bg-emerald-100 text-emerald-700" :
                          t.overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {t.completed ? "Completed" : t.overdue ? "Overdue" : "Active"}
                        </span>
                      </div>
                      {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                      {t.dueDate && <p className="text-xs text-slate-400 mt-1">Due: {t.dueDate}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-4 text-xs text-slate-400">No SMART targets set.</div>
              )}
            </div>
          )}

          {activeTab === "ILP" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Individual Learning Plans</p>
              </div>
              {isIlpsLoading ? (
                <div className="px-5 py-4"><Skeleton className="h-24 w-full" /></div>
              ) : ilps?.length ? (
                <div className="px-5 py-4 space-y-3">
                  {ilps.map(i => (
                    <div key={i.id} className="border border-slate-200 rounded p-3">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-xs text-slate-800">{i.title}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${
                          i.status === "active" ? "bg-teal-100 text-teal-700" :
                          i.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>{i.status}</span>
                      </div>
                      {i.content && <p className="text-xs text-slate-500 mt-1 line-clamp-3">{i.content}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-4 text-xs text-slate-400">No ILPs on file.</div>
              )}
            </div>
          )}

          {!["Summary", "Address", "Enrolments", "Attendance", "Performance", "ILP"].includes(activeTab) && (
            <div className="bg-white border border-slate-200 rounded px-5 py-8 text-center text-xs text-slate-400">
              {activeTab} — no data available yet.
            </div>
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
            className="w-full text-left text-xs px-4 py-2 border-b border-slate-100 text-sky-700 hover:bg-sky-50 flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3 h-3 shrink-0 text-sky-500" />
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
