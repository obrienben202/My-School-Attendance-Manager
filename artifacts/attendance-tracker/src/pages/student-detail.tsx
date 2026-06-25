import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetStudent,
  useListAttendanceRecords,
  useListTargets,
  useListIlps,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, AlertTriangle, UserCircle2, Target, FileText, ClipboardList } from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-32 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value || ""}</span>
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-white hover:bg-slate-50 text-left"
      >
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 py-4 border-t border-slate-100 bg-white">{children}</div>}
    </div>
  );
}

const LEARNER_NAV = [
  "Details",
  "Learner Progress",
  "Academic History",
  "Employment",
  "Aims",
  "Progressions",
  "Support Needs",
  "Documents",
];

export default function StudentDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [activeSection, setActiveSection] = useState("Details");

  const { data: student, isLoading: isStudentLoading } = useGetStudent(id, { query: { enabled: !!id } as any });
  const { data: attendance, isLoading: isAttendanceLoading } = useListAttendanceRecords({ studentId: id }, { query: { enabled: !!id } as any });
  const { data: targets, isLoading: isTargetsLoading } = useListTargets({ studentId: id }, { query: { enabled: !!id } as any });
  const { data: ilps, isLoading: isIlpsLoading } = useListIlps({ studentId: id }, { query: { enabled: !!id } as any });

  if (isStudentLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!student) {
    return <div className="p-12 text-center text-muted-foreground">Learner not found.</div>;
  }

  const fullName = [student.forename, student.middleNames, student.surname].filter(Boolean).join(" ");

  return (
    <div className="flex gap-0 -mx-6 -mt-6 min-h-screen">
      {/* Left sub-nav */}
      <div className="w-44 shrink-0 bg-slate-100 border-r border-slate-200 pt-4">
        <div className="px-3 pb-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Learner</p>
        </div>
        {LEARNER_NAV.map(item => (
          <button
            key={item}
            onClick={() => setActiveSection(item)}
            className={`w-full text-left text-sm px-4 py-1.5 transition-colors ${
              activeSection === item
                ? "bg-teal-700 text-white font-medium"
                : "text-slate-700 hover:bg-slate-200"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 bg-white overflow-auto">
        {/* Page title */}
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Learner Details</h1>

        {activeSection === "Details" && (
          <>
            {/* Top info row */}
            <div className="border border-slate-200 rounded mb-4 bg-white">
              <div className="px-5 py-3 grid grid-cols-2 gap-4 border-b border-slate-100">
                <InfoRow label="Name" value={`${student.forename} ${student.surname}`} />
                <InfoRow label="Student Number" value={student.personCode} />
              </div>

              {/* Health alert */}
              {student.atRisk && (
                <div className="px-5 py-2 border-b border-slate-100">
                  <div className="inline-flex items-center gap-2 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    At Risk — Requires Additional Support
                  </div>
                </div>
              )}

              {/* Photo + details grid */}
              <div className="px-5 py-4 flex gap-6">
                {/* Photo placeholder */}
                <div className="w-24 h-28 shrink-0 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-slate-300">
                  <UserCircle2 className="w-16 h-16" />
                </div>

                {/* Details: two columns */}
                <div className="flex-1 grid grid-cols-2 gap-x-10 gap-y-1">
                  {/* Left */}
                  <div className="space-y-1">
                    <InfoRow label="Full Name" value={fullName} />
                    <InfoRow label="Gender" value={student.gender} />
                    <InfoRow label="Tutor Group" value={student.yearGroup} />
                    <InfoRow label="Last Registered" value="—" />
                  </div>
                  {/* Right */}
                  <div className="space-y-1">
                    <InfoRow label="Address" value="—" />
                    <InfoRow label="Post Code" value={student.postCode} />
                    <InfoRow label="Email" value="—" />
                    <InfoRow label="Phone" value="—" />
                  </div>
                </div>
              </div>

              {/* Attendance stats row */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Attendance</p>
                  <p className={`text-lg font-bold ${student.attendancePercent < 90 ? "text-red-600" : "text-emerald-600"}`}>
                    {student.attendancePercent}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Punctuality</p>
                  <p className={`text-lg font-bold ${student.punctualityPercent < 95 ? "text-amber-600" : "text-emerald-600"}`}>
                    {student.punctualityPercent}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date of Birth</p>
                  <p className="text-sm font-medium text-slate-800">{student.dateOfBirth || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Confirmed Learner</p>
                  <p className="text-sm font-medium text-slate-800">{student.confirmedLearner ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>

            {/* Emergency Contacts */}
            <CollapsibleSection title="Emergency Contacts">
              <div className="text-sm text-slate-500 italic">No emergency contacts on record.</div>
            </CollapsibleSection>

            {/* More Details */}
            <CollapsibleSection title="More Details" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-x-10 gap-y-1">
                <InfoRow label="Title" value={student.title} />
                <InfoRow label="Forename" value={student.forename} />
                <InfoRow label="Middle Names" value={student.middleNames} />
                <InfoRow label="Surname" value={student.surname} />
                <InfoRow label="Post Code" value={student.postCode} />
                <InfoRow label="Gender" value={student.gender} />
                <InfoRow label="Date of Birth" value={student.dateOfBirth} />
                <InfoRow label="Year Group" value={student.yearGroup} />
              </div>
            </CollapsibleSection>

            {/* Attendance History */}
            <CollapsibleSection title="Recent Attendance" defaultOpen={false}>
              {isAttendanceLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : attendance?.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-slate-500">
                      <th className="pb-1 pr-4">Course</th>
                      <th className="pb-1 pr-4">Date</th>
                      <th className="pb-1">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendance.map(r => (
                      <tr key={r.id}>
                        <td className="py-1.5 pr-4 text-slate-700">{r.courseName}</td>
                        <td className="py-1.5 pr-4 text-slate-500">{r.date}</td>
                        <td className="py-1.5">
                          <span className={`font-semibold capitalize text-xs ${
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
                <p className="text-sm text-slate-400">No attendance records.</p>
              )}
            </CollapsibleSection>
          </>
        )}

        {activeSection === "Learner Progress" && (
          <CollapsibleSection title="SMART Targets">
            {isTargetsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : targets?.length ? (
              <div className="space-y-3">
                {targets.map(t => (
                  <div key={t.id} className="border border-slate-200 rounded p-3">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm text-slate-800">{t.title}</p>
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
              <p className="text-sm text-slate-400">No SMART targets set.</p>
            )}
          </CollapsibleSection>
        )}

        {activeSection === "Academic History" && (
          <CollapsibleSection title="Individual Learning Plans (ILPs)">
            {isIlpsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : ilps?.length ? (
              <div className="space-y-3">
                {ilps.map(i => (
                  <div key={i.id} className="border border-slate-200 rounded p-3">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm text-slate-800">{i.title}</p>
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
              <p className="text-sm text-slate-400">No ILPs created.</p>
            )}
          </CollapsibleSection>
        )}

        {!["Details", "Learner Progress", "Academic History"].includes(activeSection) && (
          <div className="border border-slate-200 rounded p-8 text-center text-slate-400 text-sm">
            {activeSection} — no data available yet.
          </div>
        )}
      </div>
    </div>
  );
}
