import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarClock, Plus, Pencil, Trash2, Check, X, Eye, EyeOff,
  Play, Pause, ChevronDown, ChevronUp, Clock, Mail, Info,
  RotateCcw,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Frequency = "daily" | "weekly" | "monthly" | "once";
type Format = "pdf" | "excel" | "csv";
type ScheduleStatus = "enabled" | "disabled";

type Schedule = {
  id: number;
  name: string;
  report: string;
  reportFolder: string;
  frequency: Frequency;
  dayOfWeek?: string;
  dayOfMonth?: number;
  runTime: string;
  startDate: string;
  nextRun: string;
  lastRun: string | null;
  recipients: string[];
  format: Format;
  status: ScheduleStatus;
  owner: string;
};

// ─── Reference data ────────────────────────────────────────────────────────────

const ALL_REPORTS = [
  { name: "Overall Attendance Summary", folder: "Attendance" },
  { name: "Learner Attendance Detail", folder: "Attendance" },
  { name: "Course Attendance by Date", folder: "Attendance" },
  { name: "Punctuality Report", folder: "Attendance" },
  { name: "Grade Summary by Course", folder: "Assessments" },
  { name: "Assessment Results Detail", folder: "Assessments" },
  { name: "Unconfirmed Assessments", folder: "Assessments" },
  { name: "ILP Progress Summary", folder: "ILP" },
  { name: "ILP Reviews Due", folder: "ILP" },
  { name: "At-Risk Learners", folder: "Safeguarding" },
  { name: "Planned Absence Summary", folder: "Safeguarding" },
  { name: "Markbook Verification Status", folder: "Markbook" },
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const FORMATS: { value: Format; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "excel", label: "Excel (.xlsx)" },
  { value: "csv", label: "CSV" },
];
const FREQ_LABELS: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  once: "Once",
};

// ─── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_SCHEDULES: Schedule[] = [
  {
    id: 1, name: "Weekly Attendance Summary", report: "Overall Attendance Summary", reportFolder: "Attendance",
    frequency: "weekly", dayOfWeek: "Monday", runTime: "07:00", startDate: "2025-01-06",
    nextRun: "2025-06-30", lastRun: "2025-06-23",
    recipients: ["head.of.year@college.ac.uk", "attendance@college.ac.uk"],
    format: "pdf", status: "enabled", owner: "J. Smith",
  },
  {
    id: 2, name: "Daily At-Risk Alert", report: "At-Risk Learners", reportFolder: "Safeguarding",
    frequency: "daily", runTime: "08:00", startDate: "2025-01-06",
    nextRun: "2025-06-27", lastRun: "2025-06-26",
    recipients: ["pastoral@college.ac.uk"],
    format: "pdf", status: "enabled", owner: "J. Smith",
  },
  {
    id: 3, name: "Monthly Grade Report", report: "Grade Summary by Course", reportFolder: "Assessments",
    frequency: "monthly", dayOfMonth: 1, runTime: "06:00", startDate: "2025-01-01",
    nextRun: "2025-07-01", lastRun: "2025-06-01",
    recipients: ["principal@college.ac.uk", "exams@college.ac.uk"],
    format: "excel", status: "enabled", owner: "J. Smith",
  },
  {
    id: 4, name: "ILP Reviews Due (Disabled)", report: "ILP Reviews Due", reportFolder: "ILP",
    frequency: "weekly", dayOfWeek: "Friday", runTime: "15:00", startDate: "2025-02-01",
    nextRun: "—", lastRun: "2025-03-14",
    recipients: ["tutors@college.ac.uk"],
    format: "pdf", status: "disabled", owner: "J. Smith",
  },
  {
    id: 5, name: "Absence Report — All Staff", report: "Planned Absence Summary", reportFolder: "Safeguarding",
    frequency: "weekly", dayOfWeek: "Wednesday", runTime: "09:00", startDate: "2025-01-15",
    nextRun: "2025-07-02", lastRun: "2025-06-25",
    recipients: ["hr@college.ac.uk", "pastoral@college.ac.uk", "admin@college.ac.uk"],
    format: "csv", status: "enabled", owner: "A. Jones",
  },
];

const FORMAT_BADGE: Record<Format, string> = {
  pdf: "bg-red-50 text-red-700 border-red-200",
  excel: "bg-green-50 text-green-700 border-green-200",
  csv: "bg-blue-50 text-blue-700 border-blue-200",
};

function formatFreq(s: Schedule) {
  if (s.frequency === "daily") return `Daily at ${s.runTime}`;
  if (s.frequency === "weekly") return `Weekly · ${s.dayOfWeek} at ${s.runTime}`;
  if (s.frequency === "monthly") return `Monthly · Day ${s.dayOfMonth} at ${s.runTime}`;
  if (s.frequency === "once") return `Once · ${s.startDate} at ${s.runTime}`;
  return "";
}

// ─── Blank form ────────────────────────────────────────────────────────────────

function blankForm(): Omit<Schedule, "id" | "lastRun" | "nextRun" | "owner"> {
  return {
    name: "", report: ALL_REPORTS[0].name, reportFolder: ALL_REPORTS[0].folder,
    frequency: "weekly", dayOfWeek: "Monday", dayOfMonth: 1,
    runTime: "08:00", startDate: new Date().toISOString().slice(0, 10),
    recipients: [], format: "pdf", status: "enabled",
  };
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ManageSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>(SAMPLE_SCHEDULES);
  const [showAll, setShowAll] = useState(false);         // Report Admin: view all
  const [showDetails, setShowDetails] = useState(false); // show/hide extra details
  const [searchQ, setSearchQ] = useState("");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  // Form state
  const [form, setForm] = useState(blankForm());
  const [recipientInput, setRecipientInput] = useState("");
  const [saved, setSaved] = useState(false);

  const mySchedules = useMemo(() => schedules.filter((s) => s.owner === "J. Smith"), [schedules]);
  const displaySchedules = useMemo(() => {
    const src = showAll ? schedules : mySchedules;
    return src.filter((s) =>
      !searchQ || s.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      s.report.toLowerCase().includes(searchQ.toLowerCase())
    );
  }, [schedules, mySchedules, showAll, searchQ]);

  const openCreate = () => {
    setForm(blankForm());
    setRecipientInput("");
    setSaved(false);
    setCreateOpen(true);
    setEditTarget(null);
  };

  const openEdit = (s: Schedule) => {
    setForm({
      name: s.name, report: s.report, reportFolder: s.reportFolder,
      frequency: s.frequency, dayOfWeek: s.dayOfWeek ?? "Monday",
      dayOfMonth: s.dayOfMonth ?? 1, runTime: s.runTime, startDate: s.startDate,
      recipients: [...s.recipients], format: s.format, status: s.status,
    });
    setRecipientInput("");
    setSaved(false);
    setEditTarget(s);
    setCreateOpen(false);
  };

  const addRecipient = () => {
    const v = recipientInput.trim();
    if (v && !form.recipients.includes(v)) {
      setForm((f) => ({ ...f, recipients: [...f.recipients, v] }));
    }
    setRecipientInput("");
  };

  const removeRecipient = (r: string) => setForm((f) => ({ ...f, recipients: f.recipients.filter((x) => x !== r) }));

  const computeNextRun = (f: typeof form): string => {
    const d = new Date();
    if (f.frequency === "once") return f.startDate;
    if (f.frequency === "daily") { d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
    if (f.frequency === "weekly") { d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }
    if (f.frequency === "monthly") { d.setMonth(d.getMonth() + 1, f.dayOfMonth ?? 1); return d.toISOString().slice(0, 10); }
    return "—";
  };

  const saveForm = () => {
    const reportObj = ALL_REPORTS.find((r) => r.name === form.report);
    if (editTarget) {
      setSchedules((prev) => prev.map((s) => s.id === editTarget.id
        ? { ...s, ...form, reportFolder: reportObj?.folder ?? s.reportFolder, nextRun: computeNextRun(form) }
        : s
      ));
    } else {
      const newSched: Schedule = {
        id: Date.now(),
        ...form,
        reportFolder: reportObj?.folder ?? "",
        nextRun: computeNextRun(form),
        lastRun: null,
        owner: "J. Smith",
      };
      setSchedules((prev) => [newSched, ...prev]);
    }
    setSaved(true);
    setTimeout(() => {
      setCreateOpen(false);
      setEditTarget(null);
      setSaved(false);
    }, 800);
  };

  const toggleStatus = (id: number) => {
    setSchedules((prev) => prev.map((s) => s.id === id
      ? { ...s, status: s.status === "enabled" ? "disabled" : "enabled", nextRun: s.status === "disabled" ? computeNextRun({ ...blankForm(), ...s }) : "—" }
      : s
    ));
  };

  const deleteSchedule = (id: number) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    setDeleteTarget(null);
  };

  const isFormValid = form.name.trim() && form.report && form.recipients.length > 0;
  const isDialogOpen = createOpen || !!editTarget;

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 mb-0.5">
          <CalendarClock size={18} className="text-teal-700" />
          <h1 className="text-xl font-bold text-gray-900">Manage Schedules</h1>
          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded font-medium">
            Role: Create Schedules
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Schedule reports to run automatically and be delivered by email. Manage, enable, disable, or delete your scheduled reports.
        </p>
      </div>

      {/* Info banner */}
      <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-center gap-2">
        <Info size={13} className="shrink-0" />
        Users with the <strong className="mx-0.5">Report Administrator</strong> role can view all scheduled reports.
        Schedules are accessed from the <strong className="mx-0.5">Reports</strong> section via the Schedules option in the left-hand menu.
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <Input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search schedules…"
          className="text-sm h-8 w-56"
        />

        {/* My Schedules / All Schedules toggle */}
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setShowAll(false)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${!showAll ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            My Schedules <span className="ml-1 text-gray-400">({mySchedules.length})</span>
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${showAll ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            All Schedules <span className="ml-1 text-gray-400">({schedules.length})</span>
          </button>
        </div>

        {/* Show/hide extra details */}
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded px-2.5 py-1 hover:bg-gray-50 transition-colors"
        >
          {showDetails ? <EyeOff size={12} /> : <Eye size={12} />}
          {showDetails ? "Hide" : "Show"} extra details
        </button>

        {/* Create */}
        <Button className="ml-auto gap-1.5 bg-teal-700 hover:bg-teal-800 text-xs h-8" onClick={openCreate}>
          <Plus size={13} /> Create schedule
        </Button>
      </div>

      {/* Schedule list */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {displaySchedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-gray-400 gap-3">
            <CalendarClock size={28} className="text-gray-300" />
            {searchQ ? "No schedules match your search." : "No schedules found. Click Create schedule to add one."}
          </div>
        ) : (
          <div className="space-y-2">
            {displaySchedules.map((s) => (
              <div
                key={s.id}
                className={`bg-white border rounded-lg transition-colors ${s.status === "disabled" ? "border-gray-200 opacity-70" : "border-gray-200 hover:border-teal-200"}`}
              >
                {/* Main row */}
                <div className="px-4 py-3 flex items-start gap-3">
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${s.status === "enabled" ? "bg-green-500" : "bg-gray-300"}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-800">{s.name}</span>
                      {s.status === "disabled" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded font-medium">Disabled</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${FORMAT_BADGE[s.format]}`}>
                        {s.format.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className="text-gray-400">{s.reportFolder} › </span>{s.report}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                      <span className="flex items-center gap-1"><RotateCcw size={11} className="text-gray-400" />{formatFreq(s)}</span>
                      <span className="flex items-center gap-1"><Clock size={11} className="text-gray-400" />Next: <strong className={s.status === "disabled" ? "text-gray-400" : "text-gray-700"}>{s.nextRun}</strong></span>
                      {showAll && <span className="text-gray-400">Owner: {s.owner}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleStatus(s.id)}
                      className={`flex items-center gap-0.5 text-[10px] px-2 py-1 rounded border font-semibold transition-colors ${
                        s.status === "enabled"
                          ? "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                          : "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                      }`}
                    >
                      {s.status === "enabled" ? <><Pause size={10} /> Disable</> : <><Play size={10} /> Enable</>}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center gap-0.5"
                    >
                      <Pencil size={10} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(s)}
                      className="text-[10px] px-2 py-1 rounded border border-red-100 text-red-500 hover:bg-red-50 flex items-center gap-0.5"
                    >
                      <Trash2 size={10} /> Delete
                    </button>
                  </div>
                </div>

                {/* Extra details (collapsible) */}
                {showDetails && (
                  <div className="px-4 pb-3 pt-0 border-t border-gray-100 mt-0">
                    <div className="grid grid-cols-3 gap-3 text-xs pt-2.5">
                      <div>
                        <span className="text-gray-400 block mb-0.5">Recipients</span>
                        <div className="flex flex-wrap gap-1">
                          {s.recipients.map((r) => (
                            <span key={r} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                              <Mail size={9} /> {r}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Start date</span>
                        <span>{s.startDate}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Last run</span>
                        <span>{s.lastRun ?? "Never"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={() => { setCreateOpen(false); setEditTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock size={16} />
              {editTarget ? "Edit Schedule" : "Create Schedule"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Schedule name */}
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Schedule name <span className="text-red-500">*</span></label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekly Attendance Report" className="text-sm" />
            </div>

            {/* Report */}
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Report <span className="text-red-500">*</span></label>
              <Select value={form.report} onValueChange={(v) => {
                const r = ALL_REPORTS.find((x) => x.name === v);
                setForm((f) => ({ ...f, report: v, reportFolder: r?.folder ?? "" }));
              }}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_REPORTS.map((r) => (
                    <SelectItem key={r.name} value={r.name}>
                      <span className="text-gray-400 text-xs">{r.folder} › </span>{r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frequency */}
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Frequency <span className="text-red-500">*</span></label>
              <div className="flex gap-1.5 flex-wrap">
                {(["daily", "weekly", "monthly", "once"] as Frequency[]).map((f) => (
                  <button key={f} onClick={() => setForm((frm) => ({ ...frm, frequency: f }))}
                    className={`px-3 py-1.5 rounded border text-xs font-medium capitalize transition-colors ${form.frequency === f ? "bg-teal-700 text-white border-teal-700" : "border-gray-200 text-gray-600 hover:border-teal-400"}`}>
                    {FREQ_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Day / date pickers depending on frequency */}
            <div className="grid grid-cols-2 gap-3">
              {form.frequency === "weekly" && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Day of week</label>
                  <Select value={form.dayOfWeek} onValueChange={(v) => setForm((f) => ({ ...f, dayOfWeek: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{DAYS_OF_WEEK.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {form.frequency === "monthly" && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Day of month</label>
                  <Select value={String(form.dayOfMonth ?? 1)} onValueChange={(v) => setForm((f) => ({ ...f, dayOfMonth: Number(v) }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Run time</label>
                <Input type="time" value={form.runTime} onChange={(e) => setForm((f) => ({ ...f, runTime: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Start date</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="text-sm" />
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Format</label>
              <div className="flex gap-1.5">
                {FORMATS.map(({ value, label }) => (
                  <button key={value} onClick={() => setForm((f) => ({ ...f, format: value }))}
                    className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${form.format === value ? "bg-teal-700 text-white border-teal-700" : "border-gray-200 text-gray-600 hover:border-teal-400"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Email recipients <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(press Enter or Add)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
                  placeholder="email@college.ac.uk"
                  className="text-sm flex-1"
                />
                <Button variant="outline" size="sm" onClick={addRecipient} className="text-xs shrink-0">Add</Button>
              </div>
              {form.recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.recipients.map((r) => (
                    <span key={r} className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                      <Mail size={9} /> {r}
                      <button onClick={() => removeRecipient(r)} className="ml-0.5 hover:text-red-500"><X size={9} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Enable */}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <button
                role="switch"
                aria-checked={form.status === "enabled"}
                onClick={() => setForm((f) => ({ ...f, status: f.status === "enabled" ? "disabled" : "enabled" }))}
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${form.status === "enabled" ? "bg-teal-600" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.status === "enabled" ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              Enable schedule immediately
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditTarget(null); }}>Cancel</Button>
            <Button
              className="bg-teal-700 hover:bg-teal-800 gap-1.5"
              disabled={!isFormValid || saved}
              onClick={saveForm}
            >
              {saved ? <><Check size={13} /> Saved!</> : <><Check size={13} /> {editTarget ? "Save changes" : "Create schedule"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Trash2 size={16} className="text-red-500" /> Delete Schedule</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteSchedule(deleteTarget.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
