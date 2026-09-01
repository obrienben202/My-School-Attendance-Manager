import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListSafeguardingNotesQueryKey,
  useCreateSafeguardingNote,
  useListSafeguardingNotes,
  useListStudents,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield, Flag, Lock, ArrowUpCircle, Inbox, Archive, Search,
  Plus, X, Trash2, FileText, StickyNote, Bell, ChevronRight,
  AlertTriangle, Clock, Check, Eye,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type MessageKind = "record" | "note" | "risk";
type InboxStatus = "active" | "archived";

type SafeguardingMessage = {
  id: number;
  studentId?: number;
  persisted?: boolean;
  kind: MessageKind;
  learnerName: string;
  personCode: string;
  category: string;
  summary: string;
  detail: string;
  submittedBy: string;
  date: string;
  urgent: boolean;
  locked: boolean;
  escalated: boolean;
  closed: boolean;
  status: InboxStatus;
};

// ─── Sample data ───────────────────────────────────────────────────────────────

const CATEGORIES = ["Wellbeing", "Behaviour", "Disclosure", "Attendance Concern", "Domestic Situation", "Financial Hardship", "Mental Health", "Incident"];

const SAMPLE_MESSAGES: SafeguardingMessage[] = [
  { id: 1, kind: "record", learnerName: "Evans, Liam", personCode: "PC0089", category: "Disclosure", summary: "Learner disclosed difficult home situation during tutorial", detail: "During a one-to-one tutorial session, the learner disclosed that they are experiencing significant difficulties at home including instability in housing. The learner appeared distressed and was encouraged to speak with student services. The situation has been logged in line with safeguarding procedures.", submittedBy: "J. Smith", date: "2025-01-14", urgent: true, locked: false, escalated: true, closed: false, status: "active" },
  { id: 2, kind: "note", learnerName: "Brown, Sarah", personCode: "PC0034", category: "Attendance Concern", summary: "Persistent unexplained absences — third consecutive week", detail: "The learner has now missed sessions for three consecutive weeks without providing satisfactory explanation. Contact attempts have been made by phone and email. The learner's emergency contact has also been tried without success. Further escalation may be required.", submittedBy: "A. Jones", date: "2025-01-12", urgent: false, locked: false, escalated: false, closed: false, status: "active" },
  { id: 3, kind: "risk", learnerName: "Patel, Priya", personCode: "PC0103", category: "Mental Health", summary: "Learner expressed feelings of anxiety and low mood", detail: "During a group session the learner became visibly upset and later spoke with the tutor privately. The learner mentioned persistent low mood and anxiety over academic performance. Learner has been referred to the college counselling service and parents have been notified with consent.", submittedBy: "B. Williams", date: "2025-01-10", urgent: true, locked: true, escalated: false, closed: false, status: "active" },
  { id: 4, kind: "record", learnerName: "Taylor, Marcus", personCode: "PC0118", category: "Behaviour", summary: "Altercation in common area — formal record logged", detail: "A verbal altercation occurred between this learner and another student in the common area. Security staff intervened. Both students have been spoken to separately. A formal behaviour record has been logged and the Head of Year has been notified.", submittedBy: "C. Davis", date: "2025-01-08", urgent: false, locked: false, escalated: false, closed: false, status: "active" },
  { id: 5, kind: "note", learnerName: "Wilson, Amy", personCode: "PC0142", category: "Wellbeing", summary: "Check-in following bereavement — learner coping well", detail: "Following the learner's recent bereavement, this check-in note records that the learner appears to be coping well with the support in place. They are engaging with counselling sessions and attendance has returned to normal levels. Continue monitoring.", submittedBy: "J. Smith", date: "2025-01-06", urgent: false, locked: false, escalated: false, closed: true, status: "archived" },
  { id: 6, kind: "risk", learnerName: "Hughes, Daniel", personCode: "PC0157", category: "Financial Hardship", summary: "Learner unable to afford course materials — bursary referred", detail: "The learner approached the tutor to explain they cannot afford the required course materials. They have been referred to the bursary fund and financial advice service. A risk note has been flagged to ensure follow-up is completed before the next assignment deadline.", submittedBy: "A. Jones", date: "2025-01-03", urgent: false, locked: false, escalated: false, closed: false, status: "active" },
  { id: 7, kind: "record", learnerName: "Evans, Liam", personCode: "PC0089", category: "Incident", summary: "Follow-up record — situation review with safeguarding manager", detail: "A follow-up meeting was held with the safeguarding manager following the disclosure recorded on 14/01/2025. Housing support has been arranged and the learner is now engaging positively. Continue to monitor.", submittedBy: "J. Smith", date: "2025-01-16", urgent: false, locked: false, escalated: false, closed: false, status: "active" },
];

const KIND_STYLES: Record<MessageKind, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  record: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: <FileText size={11} />, label: "Record" },
  note: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: <StickyNote size={11} />, label: "Note" },
  risk: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: <AlertTriangle size={11} />, label: "Risk" },
};

function KindBadge({ kind }: { kind: MessageKind }) {
  const s = KIND_STYLES[kind];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
      {s.icon} {s.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function errorMessage(error: unknown, fallback: string) {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  return typeof data?.error === "string" ? data.error : fallback;
}

// ─── Main component ────────────────────────────────────────────────────────────

type NavView = "inbox" | "archived" | "search" | "add-record" | "add-note";

export default function SafeguardingTutor() {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const canAccessSafeguarding = user?.role === "staff" || user?.role === "hod";
  const { data: students = [] } = useListStudents();
  const {
    data: savedNotes = [],
    isLoading: notesLoading,
    error: notesError,
  } = useListSafeguardingNotes();
  const createNote = useCreateSafeguardingNote();
  const [messages, setMessages] = useState<SafeguardingMessage[]>(SAMPLE_MESSAGES);
  const [navView, setNavView] = useState<NavView>("inbox");
  const [inboxFilter, setInboxFilter] = useState("all");
  const [inboxSearch, setInboxSearch] = useState("");
  const [detailMsg, setDetailMsg] = useState<SafeguardingMessage | null>(null);
  const [noteReply, setNoteReply] = useState("");
  const [noteSent, setNoteSent] = useState(false);
  const [noteError, setNoteError] = useState("");

  // Learner search
  const [learnerQuery, setLearnerQuery] = useState("");
  const [selectedLearnerPC, setSelectedLearnerPC] = useState<string | null>(null);

  // Add record/note form
  const [addForm, setAddForm] = useState({ studentId: null as number | null, learner: "", category: "Wellbeing", summary: "", detail: "", urgent: false, kind: "record" as MessageKind, lastContactedAt: "" });
  const [addSubmitted, setAddSubmitted] = useState(false);
  const [addError, setAddError] = useState("");

  const savedMessages = useMemo<SafeguardingMessage[]>(() =>
    savedNotes.map((note) => ({
      id: 1_000_000_000 + note.id,
      studentId: note.studentId,
      persisted: true,
      kind: "note",
      learnerName: note.learnerName,
      personCode: note.personCode,
      category: "Safeguarding note",
      summary: note.content.split(/\r?\n/, 1)[0].slice(0, 160),
      detail: note.content,
      submittedBy: note.author,
      date: note.createdAt,
      urgent: false,
      locked: false,
      escalated: false,
      closed: note.status === "archived",
      status: note.status,
    })),
    [savedNotes],
  );

  const allMessages = useMemo(
    () => [...savedMessages, ...messages],
    [savedMessages, messages],
  );

  const activeMessages = useMemo(() =>
    allMessages.filter((m) => m.status === "active"),
    [allMessages]
  );
  const archivedMessages = useMemo(() =>
    allMessages.filter((m) => m.status === "archived"),
    [allMessages]
  );

  const filteredInbox = useMemo(() => {
    let r = activeMessages;
    if (inboxFilter !== "all") r = r.filter((m) => m.kind === inboxFilter);
    if (inboxSearch) r = r.filter((m) =>
      m.learnerName.toLowerCase().includes(inboxSearch.toLowerCase()) ||
      m.category.toLowerCase().includes(inboxSearch.toLowerCase()) ||
      m.summary.toLowerCase().includes(inboxSearch.toLowerCase())
    );
    return r.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (a.escalated !== b.escalated) return a.escalated ? -1 : 1;
      return b.date.localeCompare(a.date);
    });
  }, [activeMessages, inboxFilter, inboxSearch]);

  const archiveMsg = (id: number) => setMessages((prev) => prev.map((m) => m.id === id ? { ...m, status: "archived" } : m));
  const deleteFromInbox = (id: number) => setMessages((prev) => prev.filter((m) => m.id !== id));

  const learnerMessages = useMemo(() => {
    if (!selectedLearnerPC) return [];
    return allMessages.filter((m) => m.personCode === selectedLearnerPC && !m.locked);
  }, [allMessages, selectedLearnerPC]);

  const filteredStudents = useMemo(() =>
    students.filter((s) =>
      `${s.forename} ${s.surname}`.toLowerCase().includes(learnerQuery.toLowerCase()) ||
      (s.personCode ?? "").toLowerCase().includes(learnerQuery.toLowerCase())
    ).slice(0, 8),
    [students, learnerQuery]
  );

  const addLearnerMatches = useMemo(() => {
    const query = addForm.learner.trim().toLowerCase();
    if (query.length < 2 || addForm.studentId) return [];
    return students.filter((student) =>
      `${student.forename} ${student.surname}`.toLowerCase().includes(query)
      || `${student.surname}, ${student.forename}`.toLowerCase().includes(query)
      || student.personCode.toLowerCase().includes(query)
    ).slice(0, 6);
  }, [addForm.learner, addForm.studentId, students]);

  const refreshSavedNotes = () =>
    queryClient.invalidateQueries({ queryKey: getListSafeguardingNotesQueryKey() });

  const submitAddForm = async () => {
    setAddError("");
    if (!addForm.studentId || !addForm.summary.trim()) {
      setAddError("Select a learner from the results and enter a summary before submitting.");
      return;
    }

    if (addForm.kind === "note") {
      const content = [addForm.summary.trim(), addForm.detail.trim()].filter(Boolean).join("\n\n");
      try {
        await createNote.mutateAsync({
          data: {
            studentId: addForm.studentId,
            content,
            lastContactedAt: addForm.lastContactedAt
              ? new Date(addForm.lastContactedAt).toISOString()
              : null,
          },
        });
        await refreshSavedNotes();
        setAddSubmitted(true);
      } catch (error) {
        setAddError(errorMessage(error, "The note could not be saved. Please try again."));
      }
      return;
    }

    const newMsg: SafeguardingMessage = {
      id: Date.now(),
      studentId: addForm.studentId,
      kind: addForm.kind,
      learnerName: addForm.learner,
      personCode: students.find((student) => student.id === addForm.studentId)?.personCode ?? "",
      category: addForm.category,
      summary: addForm.summary,
      detail: addForm.detail,
      submittedBy: "Current User",
      date: new Date().toISOString().slice(0, 10),
      urgent: addForm.urgent,
      locked: false,
      escalated: false,
      closed: false,
      status: "active",
    };
    setMessages((prev) => [newMsg, ...prev]);
    setAddSubmitted(true);
  };

  const submitReplyNote = async () => {
    setNoteError("");
    const content = noteReply.trim();
    if (!content) {
      setNoteError("Enter a note before sending.");
      return;
    }

    const studentId = detailMsg?.studentId
      ?? students.find((student) => student.personCode === detailMsg?.personCode)?.id;
    if (!studentId) {
      setNoteError("This learner could not be matched to a current learner record.");
      return;
    }

    try {
      await createNote.mutateAsync({ data: { studentId, content } });
      await refreshSavedNotes();
      setNoteSent(true);
    } catch (error) {
      setNoteError(errorMessage(error, "The note could not be saved. Please try again."));
    }
  };

  const urgentCount = activeMessages.filter((m) => m.urgent && !m.escalated).length;
  const escalatedCount = activeMessages.filter((m) => m.escalated).length;

  const NAV_ITEMS: { view: NavView; icon: React.ReactNode; label: string; badge?: number }[] = [
    { view: "inbox", icon: <Inbox size={14} />, label: "Inbox", badge: activeMessages.length },
    { view: "archived", icon: <Archive size={14} />, label: "Archived", badge: archivedMessages.length },
    { view: "search", icon: <Search size={14} />, label: "Learner Search" },
    { view: "add-record", icon: <FileText size={14} />, label: "Add Record" },
    { view: "add-note", icon: <StickyNote size={14} />, label: "Add Note / Risk" },
  ];

  if (authLoading) {
    return <div className="p-8 text-sm text-gray-500">Checking safeguarding access…</div>;
  }

  if (!canAccessSafeguarding) {
    return (
      <div className="p-8 max-w-xl">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <Lock size={18} className="mt-0.5 shrink-0" />
          <div>
            <h1 className="font-semibold">Safeguarding access required</h1>
            <p className="mt-1 text-sm">Your account is not authorised to read or create protected safeguarding notes.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-slate-50 flex flex-col">
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 mb-0.5">
          <Shield size={18} className="text-teal-700" />
          <h1 className="text-xl font-bold text-gray-900">Safeguarding</h1>
          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded font-medium">Tutor</span>
          {urgentCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full font-semibold">
              <Flag size={10} /> {urgentCount} urgent
            </span>
          )}
          {escalatedCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full font-semibold">
              <ArrowUpCircle size={10} /> {escalatedCount} escalated
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          View safeguarding messages shared with you. Add records, notes and risk flags about learner concerns.
          Confidential — only share with authorised staff.
        </p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left nav */}
        <div className="w-56 bg-white border-r border-gray-200 pt-2 shrink-0">
          {NAV_ITEMS.map(({ view, icon, label, badge }) => (
            <button
              key={view}
               onClick={() => {
                 setNavView(view);
                 setAddSubmitted(false);
                 setAddError("");
                 if (view === "add-note") {
                   setAddForm((form) => ({ ...form, kind: "note" }));
                 } else if (view === "add-record") {
                   setAddForm((form) => ({ ...form, kind: "record" }));
                 }
               }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                navView === view ? "bg-teal-50 text-teal-700 font-semibold border-r-2 border-teal-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className={navView === view ? "text-teal-600" : "text-gray-400"}>{icon}</span>
              <span className="flex-1 text-left">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${navView === view ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto">

          {/* Inbox */}
          {navView === "inbox" && (
            <div className="p-4">
              {/* Info banner */}
              <div className="mb-4 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2.5">
                <Bell size={12} className="mt-0.5 shrink-0" />
                You are notified on your homepage when safeguarding messages are shared with you. You can only view records and notes you have permission to see — locked records are hidden.
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  {[["all", "All"], ["record", "Records"], ["note", "Notes"], ["risk", "Risks"]].map(([v, l]) => (
                    <button key={v} onClick={() => setInboxFilter(v)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${inboxFilter === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input value={inboxSearch} onChange={(e) => setInboxSearch(e.target.value)} placeholder="Search messages…" className="pl-7 text-xs h-7 w-52" />
                </div>
                <span className="text-xs text-gray-400 ml-auto">{filteredInbox.length} message{filteredInbox.length !== 1 ? "s" : ""} (max 50 per page)</span>
              </div>

              {/* Message list */}
              {notesLoading && <p className="mb-3 text-xs text-gray-500">Loading protected notes…</p>}
              {notesError && (
                <p className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {errorMessage(notesError, "Protected notes could not be loaded.")}
                </p>
              )}
              <div className="space-y-2">
                {filteredInbox.length === 0 ? (
                  <div className="py-16 text-center text-sm text-gray-400">No messages match your filter.</div>
                ) : filteredInbox.map((msg) => (
                  <div key={msg.id} className={`bg-white border rounded-lg px-4 py-3 flex items-start gap-3 ${msg.urgent ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}>
                    {/* Flags */}
                    <div className="flex flex-col gap-1 items-center pt-0.5 shrink-0">
                      {msg.urgent && <Flag size={14} className="text-red-500" />}
                      {msg.locked && <Lock size={13} className="text-gray-500" />}
                      {msg.escalated && <ArrowUpCircle size={13} className="text-amber-500" />}
                      {!msg.urgent && !msg.locked && !msg.escalated && <div className="w-3.5" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <KindBadge kind={msg.kind} />
                        <button className="font-semibold text-sm text-teal-700 hover:underline" onClick={() => setDetailMsg(msg)}>
                          {msg.learnerName}
                        </button>
                        <span className="text-xs text-gray-400 font-mono">{msg.personCode}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{msg.category}</span>
                        {msg.urgent && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5">URGENT</span>}
                        {msg.escalated && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5">ESCALATED</span>}
                        {msg.closed && <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded px-1.5">CLOSED</span>}
                      </div>
                      <p className="text-sm text-gray-700 truncate">{msg.summary}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Submitted by {msg.submittedBy} · {formatDate(msg.date)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setDetailMsg(msg)}
                        className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center gap-0.5">
                        <Eye size={10} /> View
                      </button>
                      {!msg.persisted && (
                        <>
                          <button onClick={() => archiveMsg(msg.id)}
                            className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center gap-0.5">
                            <Archive size={10} /> Archive
                          </button>
                          <button onClick={() => deleteFromInbox(msg.id)}
                            className="text-[10px] px-2 py-1 rounded border border-red-100 text-red-500 hover:bg-red-50 flex items-center gap-0.5">
                            <Trash2 size={10} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-6 flex items-center gap-5 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1"><Flag size={11} className="text-red-500" /> Urgent message</span>
                <span className="flex items-center gap-1"><Lock size={11} className="text-gray-500" /> Locked by manager (content hidden)</span>
                <span className="flex items-center gap-1"><ArrowUpCircle size={11} className="text-amber-500" /> Escalated to manager</span>
              </div>
            </div>
          )}

          {/* Archived */}
          {navView === "archived" && (
            <div className="p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Archive size={14} /> Archived messages</h2>
              {archivedMessages.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">No archived messages.</div>
              ) : (
                <div className="space-y-2">
                  {archivedMessages.map((msg) => (
                    <div key={msg.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start gap-3 opacity-80">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <KindBadge kind={msg.kind} />
                          <button className="font-semibold text-sm text-teal-700 hover:underline" onClick={() => setDetailMsg(msg)}>{msg.learnerName}</button>
                          <span className="text-xs text-gray-400 font-mono">{msg.personCode}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{msg.category}</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{msg.summary}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Submitted by {msg.submittedBy} · {formatDate(msg.date)}</p>
                      </div>
                      <button onClick={() => setDetailMsg(msg)} className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center gap-0.5 shrink-0">
                        <Eye size={10} /> View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Learner search */}
          {navView === "search" && (
            <div className="p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2"><Search size={14} /> Learner Search</h2>
              <p className="text-xs text-gray-500 mb-4">Search for a learner to view their safeguarding records and notes. Only records shared with you are shown — locked records are hidden.</p>
              <div className="relative max-w-sm mb-4">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={learnerQuery} onChange={(e) => { setLearnerQuery(e.target.value); setSelectedLearnerPC(null); }}
                  placeholder="Search by name or person code…" className="pl-8 text-sm" autoFocus />
              </div>
              {learnerQuery.length > 0 && !selectedLearnerPC && (
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm max-w-sm mb-4">
                  {filteredStudents.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">No learners found.</p>
                  ) : filteredStudents.map((s) => {
                    const pc = s.personCode ?? `PC${String(s.id).padStart(4, "0")}`;
                    return (
                      <button key={s.id} onClick={() => { setSelectedLearnerPC(pc); setLearnerQuery(`${s.surname}, ${s.forename}`); }}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-teal-50 border-b border-gray-100 last:border-0 transition-colors">
                        <span className="font-medium text-sm text-gray-800">{s.surname}, {s.forename}</span>
                        <span className="text-xs text-gray-400 font-mono">{pc}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedLearnerPC && (
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-gray-700">{learnerQuery}</span>
                    <span className="text-xs font-mono text-gray-400">{selectedLearnerPC}</span>
                    <button onClick={() => { setSelectedLearnerPC(null); setLearnerQuery(""); }} className="text-xs text-gray-400 hover:text-gray-600 ml-auto"><X size={13} /></button>
                  </div>
                  {learnerMessages.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400 border border-gray-200 rounded-lg bg-white">
                      No records or notes have been shared with you for this learner.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {learnerMessages.map((msg) => (
                        <div key={msg.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <KindBadge kind={msg.kind} />
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{msg.category}</span>
                            {msg.urgent && <Flag size={12} className="text-red-500" />}
                          </div>
                          <p className="text-sm font-medium text-gray-800">{msg.summary}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(msg.date)} · {msg.submittedBy}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Add Record / Add Note/Risk */}
          {(navView === "add-record" || navView === "add-note") && (
            <div className="p-4 max-w-xl">
              {addSubmitted ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                    <Check size={22} className="text-teal-700" />
                  </div>
                  <p className="text-base font-bold text-gray-800">Submitted successfully</p>
                  <p className="text-sm text-gray-500 text-center">The {addForm.kind} has been logged and the relevant staff have been notified according to the template's distribution list.</p>
                   <Button className="bg-teal-700 hover:bg-teal-800 mt-2" onClick={() => { setAddSubmitted(false); setAddForm({ studentId: null, learner: "", category: "Wellbeing", summary: "", detail: "", urgent: false, kind: navView === "add-record" ? "record" : "note", lastContactedAt: "" }); }}>
                    Add another
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    {navView === "add-record" ? <><FileText size={14} /> Add Record</> : <><StickyNote size={14} /> Add Note / Risk</>}
                  </h2>
                  <div className="space-y-4">
                    {navView === "add-note" && (
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Type</label>
                        <div className="flex gap-2">
                          {(["note", "risk"] as MessageKind[]).map((k) => (
                            <button key={k} onClick={() => setAddForm((f) => ({ ...f, kind: k }))}
                              className={`px-3 py-1.5 rounded border text-xs font-medium capitalize transition-colors ${addForm.kind === k ? "bg-teal-700 text-white border-teal-700" : "border-gray-200 text-gray-600 hover:border-teal-400"}`}>
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Learner name <span className="text-red-500">*</span></label>
                       <Input value={addForm.learner} onChange={(e) => setAddForm((f) => ({ ...f, studentId: null, learner: e.target.value }))} placeholder="Start typing learner name or person code…" className="text-sm" />
                       {addLearnerMatches.length > 0 && (
                         <div className="mt-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
                           {addLearnerMatches.map((student) => (
                             <button
                               key={student.id}
                               type="button"
                               onClick={() => setAddForm((form) => ({ ...form, studentId: student.id, learner: `${student.surname}, ${student.forename}` }))}
                               className="flex w-full items-center justify-between border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-teal-50 last:border-b-0"
                             >
                               <span>{student.surname}, {student.forename}</span>
                               <span className="font-mono text-xs text-gray-400">{student.personCode}</span>
                             </button>
                           ))}
                         </div>
                       )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Category <span className="text-red-500">*</span></label>
                      <Select value={addForm.category} onValueChange={(v) => setAddForm((f) => ({ ...f, category: v }))}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Summary <span className="text-red-500">*</span></label>
                      <Input value={addForm.summary} onChange={(e) => setAddForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Brief summary…" className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Detail</label>
                      <textarea value={addForm.detail} onChange={(e) => setAddForm((f) => ({ ...f, detail: e.target.value }))} rows={4}
                        placeholder="Full details of the concern or incident…"
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                    </div>
                    {addForm.kind === "note" && (
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Learner last contacted</label>
                        <Input type="datetime-local" value={addForm.lastContactedAt} onChange={(e) => setAddForm((f) => ({ ...f, lastContactedAt: e.target.value }))} className="text-sm" />
                        <p className="mt-1 text-[10px] text-gray-500">Leave blank when this note does not record direct contact.</p>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input type="checkbox" checked={addForm.urgent} onChange={(e) => setAddForm((f) => ({ ...f, urgent: e.target.checked }))} className="rounded accent-red-500" />
                      <Flag size={13} className="text-red-400" /> Mark as <strong>urgent</strong>
                      <span className="text-xs text-gray-400 font-normal">(will alert recipients immediately)</span>
                    </label>
                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      This information is confidential. It will be shared with the appropriate staff according to the notification settings for the selected category.
                    </div>
                     {addError && <p className="text-xs font-medium text-red-600" role="alert">{addError}</p>}
                     <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5" disabled={createNote.isPending} onClick={submitAddForm}>
                       <Check size={13} /> {createNote.isPending && addForm.kind === "note" ? "Saving…" : "Submit"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailMsg} onOpenChange={() => { setDetailMsg(null); setNoteReply(""); setNoteSent(false); setNoteError(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <KindBadge kind={detailMsg?.kind ?? "note"} />
              {detailMsg?.learnerName}
              {detailMsg?.urgent && <Flag size={13} className="text-red-500" />}
              {detailMsg?.locked && <Lock size={13} className="text-gray-500" />}
              {detailMsg?.escalated && <ArrowUpCircle size={13} className="text-amber-500" />}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View this protected safeguarding message and add a follow-up note.
            </DialogDescription>
          </DialogHeader>
          {detailMsg && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-400 block">Person code</span><span className="font-mono">{detailMsg.personCode}</span></div>
                <div><span className="text-gray-400 block">Category</span>{detailMsg.category}</div>
                <div><span className="text-gray-400 block">Date</span>{formatDate(detailMsg.date)}</div>
                <div><span className="text-gray-400 block">Submitted by</span>{detailMsg.submittedBy}</div>
                <div><span className="text-gray-400 block">Status</span>
                  {detailMsg.closed ? <span className="text-green-700 font-semibold">Closed</span> : <span className="text-amber-700 font-semibold">Open</span>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Summary</p>
                <p className="font-medium text-gray-800">{detailMsg.summary}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Detail</p>
                <p className="text-gray-700 text-sm leading-relaxed">{detailMsg.detail}</p>
              </div>
              {detailMsg.locked && (
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2.5">
                  <Lock size={12} /> This record has been locked by a Safeguarding Manager. Some content may be restricted.
                </div>
              )}
              {/* Add note reply */}
              {!noteSent && (
                <div className="border-t border-gray-100 pt-3">
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Add a note</label>
                  <textarea value={noteReply} onChange={(e) => setNoteReply(e.target.value)} rows={2}
                    placeholder="Add a follow-up note…"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" />
                  {noteError && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{noteError}</p>}
                </div>
              )}
              {noteSent && <p className="text-xs text-green-700 font-semibold flex items-center gap-1"><Check size={12} /> Note added.</p>}
            </div>
          )}
          <DialogFooter className="gap-2">
            {!noteSent && (
              <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5 text-sm" disabled={createNote.isPending} onClick={submitReplyNote}>
                <Plus size={13} /> {createNote.isPending ? "Saving…" : "Send note"}
              </Button>
            )}
            <Button variant="outline" onClick={() => { setDetailMsg(null); setNoteReply(""); setNoteSent(false); setNoteError(""); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
