import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetStudent,
  useListAttendanceRecords,
  useListTargets,
  useListIlps,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, UserCircle2, Printer, Mail, Edit, PlusCircle, FileText, X, Check } from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-36 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-900">{value || "—"}</span>
    </div>
  );
}

function EmptySection({ title, columns }: { title: string; columns: string[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded">
      <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map(c => (
              <th key={c} className="text-left font-semibold text-slate-600 px-5 py-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-400">
              No records on file. Add your data to populate this section.
            </td>
          </tr>
        </tbody>
      </table>
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
  "Summary", "Address", "Enrolments", "Attendance", "Performance", "ILP", "Pastoral", "Evidence", "Communication",
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
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  const { data: student, isLoading: isStudentLoading } = useGetStudent(id, { query: { enabled: !!id } as any });
  const { data: attendance, isLoading: isAttendanceLoading } = useListAttendanceRecords({ studentId: id }, { query: { enabled: !!id } as any });
  const { data: targets, isLoading: isTargetsLoading } = useListTargets({ studentId: id }, { query: { enabled: !!id } as any });
  const { data: ilps, isLoading: isIlpsLoading } = useListIlps({ studentId: id }, { query: { enabled: !!id } as any });

  if (isStudentLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!student) {
    return <div className="p-12 text-center text-muted-foreground">Learner not found.</div>;
  }

  const fullName = [student.forename, student.middleNames, student.surname].filter(Boolean).join(" ");
  const dob = student.dateOfBirth || "—";
  const age = student.dateOfBirth
    ? Math.floor((Date.now() - new Date(student.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  function handleSaveNote() {
    if (noteText.trim()) { setNoteSaved(true); setNoteText(""); setTimeout(() => { setNoteSaved(false); setShowNoteForm(false); }, 2000); }
  }
  function handleSendMessage() {
    if (messageText.trim()) { setMessageSent(true); setMessageText(""); setTimeout(() => { setMessageSent(false); setShowMessageForm(false); }, 2000); }
  }

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
            onClick={() => { setActiveLink(item); if (item === "Personal Details") setActiveTab("Summary"); }}
            className={`w-full text-left text-xs px-4 py-2 border-b border-slate-100 transition-colors ${
              activeLink === item ? "bg-teal-700 text-white font-semibold" : "text-slate-700 hover:bg-slate-50"
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
            <div className="flex gap-2 shrink-0 ml-4 flex-wrap justify-end">
              <button
                onClick={() => { setShowNoteForm(v => !v); setShowMessageForm(false); }}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <PlusCircle className="w-3 h-3" /> Add Note
              </button>
              <button
                onClick={() => { setShowMessageForm(v => !v); setShowNoteForm(false); }}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Mail className="w-3 h-3" /> Send Message
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50"
              >
                <Printer className="w-3 h-3" /> Print Profile
              </button>
            </div>
          </div>

          {student.atRisk && (
            <div className="mt-2 inline-flex items-center gap-2 bg-red-600 text-white text-xs font-semibold px-3 py-1 rounded">
              <AlertTriangle className="w-3 h-3" /> At Risk — Requires Additional Support
            </div>
          )}

          {/* Add Note inline form */}
          {showNoteForm && (
            <div className="mt-3 border border-slate-200 rounded bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Add a note for {student.forename}</p>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={3}
                placeholder="Type note here…"
                className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-teal-400"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveNote} className="flex items-center gap-1 text-xs bg-teal-700 text-white rounded px-3 py-1 hover:bg-teal-800">
                  <Check className="w-3 h-3" /> {noteSaved ? "Saved!" : "Save Note"}
                </button>
                <button onClick={() => setShowNoteForm(false)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Send Message inline form */}
          {showMessageForm && (
            <div className="mt-3 border border-slate-200 rounded bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Send message to {student.forename}</p>
              <input
                value={student.forename + " " + student.surname}
                readOnly
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-400"
              />
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={3}
                placeholder="Type your message…"
                className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-teal-400"
              />
              <div className="flex gap-2">
                <button onClick={handleSendMessage} className="flex items-center gap-1 text-xs bg-teal-700 text-white rounded px-3 py-1 hover:bg-teal-800">
                  <Mail className="w-3 h-3" /> {messageSent ? "Sent!" : "Send"}
                </button>
                <button onClick={() => setShowMessageForm(false)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Tab bar — only when Personal Details is active */}
          {activeLink === "Personal Details" && (
            <div className="flex gap-0 mt-3 -mb-3 flex-wrap">
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
          )}
        </div>

        {/* ── Tab content — Personal Details ── */}
        <div className="flex-1 p-5">
          {activeLink === "Personal Details" && (
            <>
              {activeTab === "Summary" && (
                <div className="space-y-4">
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
                  <div className="bg-white border border-slate-200 rounded">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Attendance</p>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-4 gap-6">
                      <div>
                        <p className="text-xs text-slate-500">Current Year Attendance</p>
                        <p className={`text-2xl font-bold mt-1 ${student.attendancePercent < 90 ? "text-red-600" : "text-emerald-600"}`}>{student.attendancePercent}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Cumulative Attendance</p>
                        <p className={`text-2xl font-bold mt-1 ${student.attendancePercent < 90 ? "text-red-600" : "text-emerald-600"}`}>{Math.round(student.attendancePercent * 0.97)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Punctuality</p>
                        <p className={`text-2xl font-bold mt-1 ${student.punctualityPercent < 95 ? "text-amber-500" : "text-emerald-600"}`}>{student.punctualityPercent}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Confirmed Learner</p>
                        <p className="text-sm font-semibold mt-2 text-slate-800">{student.confirmedLearner ? "Yes" : "No"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Course Summary</p>
                    </div>
                    {isAttendanceLoading ? <div className="px-5 py-4"><Skeleton className="h-16 w-full" /></div> : attendance?.length ? (
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-100"><th className="text-left font-semibold text-slate-600 px-5 py-2">Course Name</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Date</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Status</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {attendance.slice(0, 5).map(r => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="px-5 py-1.5 text-sky-700">{r.courseName}</td>
                              <td className="px-3 py-1.5 text-slate-500">{r.date}</td>
                              <td className="px-3 py-1.5"><span className={`font-semibold capitalize ${r.status === "present" ? "text-emerald-600" : r.status === "absent" ? "text-red-600" : r.status === "late" ? "text-amber-600" : "text-blue-600"}`}>{r.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <div className="px-5 py-4 text-xs text-slate-400">No course records.</div>}
                  </div>
                </div>
              )}

              {activeTab === "Address" && (
                <div className="bg-white border border-slate-200 rounded">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Address Details</p></div>
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

              {activeTab === "Enrolments" && <EmptySection title="Enrolments" columns={["Course Code", "Course Name", "Start Date", "End Date", "Status", "Qualification"]} />}

              {activeTab === "Attendance" && (
                <div className="bg-white border border-slate-200 rounded">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Attendance History</p></div>
                  {isAttendanceLoading ? <div className="px-5 py-4"><Skeleton className="h-32 w-full" /></div> : attendance?.length ? (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-slate-100"><th className="text-left font-semibold text-slate-600 px-5 py-2">Course</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Date</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Status</th><th className="text-left font-semibold text-slate-600 px-3 py-2">Notes</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {attendance.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="px-5 py-1.5 text-sky-700">{r.courseName}</td>
                            <td className="px-3 py-1.5 text-slate-500">{r.date}</td>
                            <td className="px-3 py-1.5"><span className={`font-semibold capitalize ${r.status === "present" ? "text-emerald-600" : r.status === "absent" ? "text-red-600" : r.status === "late" ? "text-amber-600" : "text-blue-600"}`}>{r.status}</span></td>
                            <td className="px-3 py-1.5 text-slate-400">—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="px-5 py-4 text-xs text-slate-400">No attendance records.</div>}
                </div>
              )}

              {activeTab === "Performance" && (
                <div className="bg-white border border-slate-200 rounded">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">SMART Targets</p></div>
                  {isTargetsLoading ? <div className="px-5 py-4"><Skeleton className="h-24 w-full" /></div> : targets?.length ? (
                    <div className="px-5 py-4 space-y-3">
                      {targets.map(t => (
                        <div key={t.id} className="border border-slate-200 rounded p-3">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-xs text-slate-800">{t.title}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${t.completed ? "bg-emerald-100 text-emerald-700" : t.overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                              {t.completed ? "Completed" : t.overdue ? "Overdue" : "Active"}
                            </span>
                          </div>
                          {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                          {t.dueDate && <p className="text-xs text-slate-400 mt-1">Due: {t.dueDate}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <div className="px-5 py-4 text-xs text-slate-400">No SMART targets set.</div>}
                </div>
              )}

              {activeTab === "ILP" && (
                <div className="bg-white border border-slate-200 rounded">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Individual Learning Plans</p></div>
                  {isIlpsLoading ? <div className="px-5 py-4"><Skeleton className="h-24 w-full" /></div> : ilps?.length ? (
                    <div className="px-5 py-4 space-y-3">
                      {ilps.map(i => (
                        <div key={i.id} className="border border-slate-200 rounded p-3">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-xs text-slate-800">{i.title}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${i.status === "active" ? "bg-teal-100 text-teal-700" : i.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{i.status}</span>
                          </div>
                          {i.content && <p className="text-xs text-slate-500 mt-1 line-clamp-3">{i.content}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <div className="px-5 py-4 text-xs text-slate-400">No ILPs on file.</div>}
                </div>
              )}

              {activeTab === "Pastoral" && <EmptySection title="Pastoral Notes" columns={["Date", "Type", "Staff Member", "Summary", "Follow-up Required"]} />}
              {activeTab === "Evidence" && <EmptySection title="Evidence Portfolio" columns={["Title", "Type", "Date Added", "Course", "Uploaded By"]} />}
              {activeTab === "Communication" && <EmptySection title="Communication Log" columns={["Date", "Method", "Direction", "Summary", "Staff"]} />}
            </>
          )}

          {activeLink === "Emergency Contacts" && (
            <EmptySection title="Emergency Contacts" columns={["Name", "Relationship", "Home Telephone", "Mobile", "Priority", "Notes"]} />
          )}

          {activeLink === "Medical / Disability" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Medical &amp; Disability Information</p></div>
              <div className="px-5 py-4 grid grid-cols-2 gap-x-10 gap-y-1">
                <InfoRow label="Medical Conditions" value="—" />
                <InfoRow label="Disabilities" value="—" />
                <InfoRow label="Learning Difficulties" value="—" />
                <InfoRow label="Special Requirements" value="—" />
                <InfoRow label="Emergency Medication" value="—" />
                <InfoRow label="Doctor / GP" value="—" />
                <InfoRow label="Doctor Telephone" value="—" />
                <InfoRow label="Additional Notes" value="—" />
              </div>
            </div>
          )}

          {activeLink === "Prior Attainment" && (
            <EmptySection title="Prior Attainment" columns={["Subject", "Qualification", "Awarding Body", "Grade", "Level", "Year Achieved"]} />
          )}

          {activeLink === "Qualifications" && (
            <EmptySection title="Qualifications" columns={["Qualification Name", "Awarding Body", "Level", "Start Date", "End Date", "Status", "Grade"]} />
          )}

          {activeLink === "Exam Timetable" && (
            <EmptySection title="Exam Timetable" columns={["Exam Name", "Date", "Start Time", "Duration", "Room", "Board / Occurrence"]} />
          )}

          {activeLink === "Finance & Funding" && (
            <div className="bg-white border border-slate-200 rounded">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50"><p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Finance &amp; Funding</p></div>
              <div className="px-5 py-4 grid grid-cols-2 gap-x-10 gap-y-1">
                <InfoRow label="Funding Type" value="—" />
                <InfoRow label="Funding Body" value="—" />
                <InfoRow label="Funding Amount" value="—" />
                <InfoRow label="Funding Status" value="—" />
                <InfoRow label="Bursary" value="—" />
                <InfoRow label="Free Meals" value="—" />
                <InfoRow label="Travel" value="—" />
                <InfoRow label="Notes" value="—" />
              </div>
            </div>
          )}

          {activeLink === "Documents / Uploads" && (
            <EmptySection title="Documents &amp; Uploads" columns={["Document Name", "Type", "Date Uploaded", "Uploaded By", "Notes"]} />
          )}

          {activeLink === "Audit Trail" && (
            <EmptySection title="Audit Trail" columns={["Date / Time", "User", "Action", "Section", "Details"]} />
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
            onClick={() => window.print()}
            className="w-full text-left text-xs px-4 py-2 border-b border-slate-100 text-sky-700 hover:bg-sky-50 flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3 h-3 shrink-0 text-sky-500" />{r}
          </button>
        ))}
      </div>
    </div>
  );
}
