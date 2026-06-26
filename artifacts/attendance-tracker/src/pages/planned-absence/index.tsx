import { useState, useMemo } from "react";
import { useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Check, X, Clock, CalendarOff, Plus, Search, Upload,
  ChevronRight, AlertTriangle, Info, CheckCircle2, XCircle,
} from "lucide-react";

// ─── Reference data ────────────────────────────────────────────────────────────

const ABSENCE_REASONS = [
  "All reasons",
  "Holiday / Vacation",
  "University Visit",
  "Religious Holiday",
  "Medical Appointment",
  "Bereavement",
  "Sports / Match",
  "Work Experience",
  "Other",
];

const APPROVAL_STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "awaiting", label: "Awaiting Decision" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "submitted", label: "Submitted" },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

type AbsenceStatus = "awaiting" | "approved" | "declined" | "submitted";

type AbsenceRequest = {
  id: number;
  learnerName: string;
  personCode: string;
  reason: string;
  from: string;
  to: string;
  partDay: boolean;
  startTime?: string;
  endTime?: string;
  notes: string;
  status: AbsenceStatus;
  submittedBy: "learner" | "staff";
  evidence: boolean;
};

type CreateStep = "learner" | "dates" | "reason" | "review";
type DateType = "single" | "range" | "mixed";

// ─── Sample data ───────────────────────────────────────────────────────────────

function buildSampleAbsences(students: { id: number; forename: string; surname: string; personCode?: string | null }[]): AbsenceRequest[] {
  const reasons = ABSENCE_REASONS.slice(1);
  const statuses: AbsenceStatus[] = ["awaiting", "approved", "declined", "submitted", "awaiting", "approved"];
  return students.slice(0, 18).map((s, i) => ({
    id: i + 1,
    learnerName: `${s.surname}, ${s.forename}`,
    personCode: s.personCode ?? `PC${String(s.id).padStart(4, "0")}`,
    reason: reasons[i % reasons.length],
    from: `2025-${String(1 + (i % 6)).padStart(2, "0")}-${String(10 + (i % 15)).padStart(2, "0")}`,
    to: `2025-${String(1 + (i % 6)).padStart(2, "0")}-${String(12 + (i % 15)).padStart(2, "0")}`,
    partDay: i % 5 === 0,
    startTime: i % 5 === 0 ? "09:00" : undefined,
    endTime: i % 5 === 0 ? "12:00" : undefined,
    notes: i % 3 === 0 ? "Learner has provided medical documentation." : "",
    status: statuses[i % statuses.length],
    submittedBy: i % 4 === 0 ? "staff" : "learner",
    evidence: i % 3 === 1,
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AbsenceStatus, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  awaiting: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: <Clock size={11} />, label: "Awaiting Decision" },
  approved: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle2 size={11} />, label: "Approved" },
  declined: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: <XCircle size={11} />, label: "Declined" },
  submitted: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: <ChevronRight size={11} />, label: "Submitted" },
};

function StatusBadge({ status }: { status: AbsenceStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
      {s.icon} {s.label}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PlannedAbsence() {
  const [activeTab, setActiveTab] = useState<"view" | "create">("view");

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 mb-0.5">
          <CalendarOff size={18} className="text-teal-700" />
          <h1 className="text-xl font-bold text-gray-900">Planned Absence</h1>
        </div>
        <p className="text-sm text-gray-500">
          View and manage planned absence requests. Approve or decline learner submissions, or create absences on behalf of learners.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-0">
        {(["create", "view"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-teal-700 text-teal-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab === "create" ? "Create an absence" : "View absences"}
          </button>
        ))}
      </div>

      {activeTab === "view" ? <ViewAbsences /> : <CreateAbsence />}
    </div>
  );
}

// ─── View absences tab ─────────────────────────────────────────────────────────

function ViewAbsences() {
  const { data: students = [] } = useListStudents();
  const allAbsences = useMemo(() => buildSampleAbsences(students), [students]);

  const [forename, setForename] = useState("");
  const [surname, setSurname] = useState("");
  const [personCode, setPersonCode] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("awaiting");
  const [fromDate, setFromDate] = useState("2025-01-09");
  const [toDate, setToDate] = useState("2026-03-12");
  const [absenceReason, setAbsenceReason] = useState("All reasons");

  const [results, setResults] = useState<AbsenceRequest[]>([]);
  const [searched, setSearched] = useState(false);
  const [absences, setAbsences] = useState<AbsenceRequest[]>(allAbsences);

  // Detail dialog
  const [detailRow, setDetailRow] = useState<AbsenceRequest | null>(null);

  const doSearch = () => {
    let r = allAbsences;
    if (forename) r = r.filter((a) => a.learnerName.toLowerCase().includes(forename.toLowerCase()));
    if (surname) r = r.filter((a) => a.learnerName.toLowerCase().includes(surname.toLowerCase()));
    if (personCode) r = r.filter((a) => a.personCode.toLowerCase().includes(personCode.toLowerCase()));
    if (approvalStatus !== "all") r = r.filter((a) => a.status === approvalStatus);
    if (absenceReason !== "All reasons") r = r.filter((a) => a.reason === absenceReason);
    if (fromDate) r = r.filter((a) => a.from >= fromDate);
    if (toDate) r = r.filter((a) => a.to <= toDate);
    setResults(r);
    setSearched(true);
  };

  const updateStatus = (id: number, status: AbsenceStatus) => {
    const update = (list: AbsenceRequest[]) => list.map((a) => a.id === id ? { ...a, status } : a);
    setAbsences(update);
    setResults(update);
    if (detailRow?.id === id) setDetailRow((prev) => prev ? { ...prev, status } : null);
  };

  const pastDate = (iso: string) => new Date(iso) < new Date();

  return (
    <div>
      {/* Search panel */}
      <div className="px-6 py-5 bg-white border-b border-gray-200">
        <div className="grid grid-cols-3 gap-4 max-w-4xl">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Forename / Known as / Preferred first name</label>
            <Input value={forename} onChange={(e) => setForename(e.target.value)} placeholder="Forename…" className="text-sm" onKeyDown={(e) => e.key === "Enter" && doSearch()} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Surname</label>
            <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Surname…" className="text-sm" onKeyDown={(e) => e.key === "Enter" && doSearch()} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Person code</label>
            <Input value={personCode} onChange={(e) => setPersonCode(e.target.value)} placeholder="Person code…" className="text-sm" onKeyDown={(e) => e.key === "Enter" && doSearch()} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Approval status</label>
            <Select value={approvalStatus} onValueChange={setApprovalStatus}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPROVAL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">From</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">To</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Absence reason</label>
            <Select value={absenceReason} onValueChange={setAbsenceReason}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ABSENCE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-4 bg-teal-700 hover:bg-teal-800 gap-2" onClick={doSearch}>
          <Search size={14} /> Search and display result
        </Button>
      </div>

      {/* Auto-approval note */}
      <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-start gap-2">
        <Info size={13} className="mt-0.5 shrink-0" />
        Absence requests submitted by learners or created by staff can be set to approve automatically for certain absence reasons (e.g. bereavement).
        The default setting for automatic approval is <strong className="ml-0.5">No</strong> — configure in Absence Reasons reference data.
      </div>

      {/* Results */}
      {!searched ? (
        <div className="px-6 py-16 text-center text-sm text-gray-400">
          Enter search criteria above and click <strong>Search and display result</strong>.
        </div>
      ) : results.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-gray-400">No absence requests match your search.</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                {["Learner", "Person code", "Absence reason", "Date(s)", "Type", "Submitted by", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, ri) => (
                <tr key={row.id} className={`${ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"} border-b border-gray-100 hover:bg-teal-50/30 transition-colors`}>
                  <td className="px-4 py-2.5">
                    <button className="font-semibold text-teal-700 hover:underline text-left" onClick={() => setDetailRow(row)}>
                      {row.learnerName}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-500">{row.personCode}</td>
                  <td className="px-4 py-2.5 text-gray-700">{row.reason}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {row.from === row.to ? formatDate(row.from) : `${formatDate(row.from)} – ${formatDate(row.to)}`}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {row.partDay ? (
                      <span>Part day <span className="text-gray-400">({row.startTime}–{row.endTime})</span></span>
                    ) : "Full day"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`capitalize text-[10px] px-2 py-0.5 rounded-full font-medium ${row.submittedBy === "learner" ? "bg-slate-100 text-slate-600" : "bg-teal-50 text-teal-700"}`}>
                      {row.submittedBy}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {row.status !== "approved" && !row.status.startsWith("d") && (
                        <button
                          onClick={() => updateStatus(row.id, "approved")}
                          className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                        >
                          <Check size={10} /> Approve
                        </button>
                      )}
                      {row.status !== "declined" && (
                        <button
                          onClick={() => updateStatus(row.id, "declined")}
                          className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          <X size={10} /> Decline
                        </button>
                      )}
                      <button
                        onClick={() => setDetailRow(row)}
                        className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Past-date warning note */}
      {searched && results.some((r) => pastDate(r.from)) && (
        <div className="mx-6 my-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Approving an absence for a <strong>past date</strong> will not automatically update the register — only current and future date approvals update registers.
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailRow} onOpenChange={() => setDetailRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Absence Request — {detailRow?.learnerName}
            </DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-xs text-gray-500 block">Person code</span><span className="font-mono">{detailRow.personCode}</span></div>
                <div><span className="text-xs text-gray-500 block">Status</span><StatusBadge status={detailRow.status} /></div>
                <div><span className="text-xs text-gray-500 block">Absence reason</span>{detailRow.reason}</div>
                <div><span className="text-xs text-gray-500 block">Submitted by</span><span className="capitalize">{detailRow.submittedBy}</span></div>
                <div>
                  <span className="text-xs text-gray-500 block">Date(s)</span>
                  {detailRow.from === detailRow.to ? formatDate(detailRow.from) : `${formatDate(detailRow.from)} – ${formatDate(detailRow.to)}`}
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Type</span>
                  {detailRow.partDay ? `Part day (${detailRow.startTime}–${detailRow.endTime})` : "Full day"}
                </div>
              </div>
              {detailRow.notes && (
                <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-xs text-gray-700">
                  <span className="font-semibold block mb-0.5 text-gray-500">Notes</span>
                  {detailRow.notes}
                </div>
              )}
              {detailRow.evidence && (
                <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded p-2">
                  <Upload size={12} /> Evidence attached — view on learner's Docs &amp; Comms tab.
                </div>
              )}
              {pastDate(detailRow.from) && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  This absence is for a past date. Approving will not update the register.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2">
            {detailRow && detailRow.status !== "approved" && (
              <Button className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={() => updateStatus(detailRow.id, "approved")}>
                <Check size={13} /> Approve
              </Button>
            )}
            {detailRow && detailRow.status !== "declined" && (
              <Button variant="destructive" className="gap-1.5" onClick={() => updateStatus(detailRow.id, "declined")}>
                <X size={13} /> Decline
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailRow(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Create an absence tab ─────────────────────────────────────────────────────

function CreateAbsence() {
  const { data: students = [] } = useListStudents();
  const [step, setStep] = useState<CreateStep>("learner");

  // Learner selection
  const [learnerSearch, setLearnerSearch] = useState("");
  const [selectedLearner, setSelectedLearner] = useState<{ id: number; name: string; personCode: string; attendance: string } | null>(null);

  // Date config
  const [dateType, setDateType] = useState<DateType>("single");
  const [singleDate, setSingleDate] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [partDay, setPartDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  // Reason & notes
  const [reason, setReason] = useState("none");
  const [notes, setNotes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<string | null>(null);

  // Submitted
  const [submitted, setSubmitted] = useState(false);

  const filteredStudents = useMemo(() =>
    students.filter((s) =>
      `${s.forename} ${s.surname}`.toLowerCase().includes(learnerSearch.toLowerCase()) ||
      (s.personCode ?? "").toLowerCase().includes(learnerSearch.toLowerCase())
    ).slice(0, 8),
    [students, learnerSearch]
  );

  const selectLearner = (s: typeof students[0]) => {
    setSelectedLearner({
      id: s.id,
      name: `${s.surname}, ${s.forename}`,
      personCode: s.personCode ?? `PC${String(s.id).padStart(4, "0")}`,
      attendance: `${70 + (s.id % 25)}%`,
    });
    setLearnerSearch("");
    setStep("dates");
  };

  const reset = () => {
    setStep("learner");
    setSelectedLearner(null);
    setLearnerSearch("");
    setDateType("single");
    setSingleDate("");
    setRangeFrom("");
    setRangeTo("");
    setPartDay(false);
    setReason("none");
    setNotes("");
    setEvidenceFile(null);
    setSubmitted(false);
  };

  const STEPS: CreateStep[] = ["learner", "dates", "reason", "review"];
  const stepLabels: Record<CreateStep, string> = { learner: "Select Learner", dates: "Absence Dates", reason: "Reason & Evidence", review: "Review & Submit" };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">Absence submitted</h2>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          The planned absence for <strong>{selectedLearner?.name}</strong> has been recorded.
          {selectedLearner && <span className="block mt-1">Any uploaded evidence will appear on the learner's Docs &amp; Comms tab.</span>}
        </p>
        <Button className="bg-teal-700 hover:bg-teal-800 mt-2" onClick={reset}>Create another absence</Button>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-2xl">
      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-2 text-xs font-semibold ${step === s ? "text-teal-700" : STEPS.indexOf(step) > i ? "text-green-600" : "text-gray-400"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                step === s ? "bg-teal-700 text-white border-teal-700" :
                STEPS.indexOf(step) > i ? "bg-green-100 text-green-700 border-green-400" :
                "bg-white text-gray-400 border-gray-300"
              }`}>
                {STEPS.indexOf(step) > i ? <Check size={10} /> : i + 1}
              </span>
              <span className="hidden sm:block">{stepLabels[s]}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`w-8 h-px mx-2 ${STEPS.indexOf(step) > i ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {/* Step: Select learner */}
      {step === "learner" && (
        <div className="space-y-4">
          <h2 className="font-bold text-gray-800 text-base">Select a learner</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={learnerSearch}
              onChange={(e) => setLearnerSearch(e.target.value)}
              placeholder="Search by name or person code…"
              className="pl-8 text-sm"
              autoFocus
            />
          </div>
          {learnerSearch.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {filteredStudents.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No learners found.</p>
              ) : filteredStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectLearner(s)}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-teal-50 transition-colors border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-sm text-gray-800">{s.surname}, {s.forename}</span>
                  <span className="text-xs text-gray-400 font-mono">{s.personCode ?? `PC${String(s.id).padStart(4, "0")}`}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step: Absence dates */}
      {step === "dates" && selectedLearner && (
        <div className="space-y-5">
          <div>
            <h2 className="font-bold text-gray-800 text-base mb-0.5">Absence dates</h2>
            <p className="text-xs text-gray-500">Recording for: <strong>{selectedLearner.name}</strong> ({selectedLearner.personCode})</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Absence type</p>
            <div className="space-y-2">
              {([
                { val: "single", label: "One day or part of one day" },
                { val: "range", label: "More than one full day" },
                { val: "mixed", label: "Parts of days and then full days (record each separately)" },
              ] as { val: DateType; label: string }[]).map(({ val, label }) => (
                <label key={val} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="dateType" value={val} checked={dateType === val} onChange={() => { setDateType(val); setPartDay(false); }}
                    className="accent-teal-600" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {dateType === "single" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Date <span className="text-red-500">*</span></label>
                <Input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className="text-sm w-48" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={partDay} onChange={(e) => setPartDay(e.target.checked)} className="rounded accent-teal-600" />
                Part of the day only
              </label>
              {partDay && (
                <div className="flex gap-4 pl-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Start time</label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-sm w-32" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">End time</label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-sm w-32" />
                  </div>
                </div>
              )}
            </div>
          )}

          {dateType === "range" && (
            <div className="flex gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">From <span className="text-red-500">*</span></label>
                <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="text-sm w-40" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">To <span className="text-red-500">*</span></label>
                <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="text-sm w-40" />
              </div>
            </div>
          )}

          {dateType === "mixed" && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              For mixed absences, record each period separately — first create the part-day absences, then create the full-day absences.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep("learner")}>Back</Button>
            <Button
              className="bg-teal-700 hover:bg-teal-800"
              disabled={dateType === "single" ? !singleDate : dateType === "range" ? !rangeFrom || !rangeTo : false}
              onClick={() => setStep("reason")}
            >
              Continue <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Reason & evidence */}
      {step === "reason" && (
        <div className="space-y-5">
          <h2 className="font-bold text-gray-800 text-base">Absence reason &amp; evidence</h2>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Absence reason <span className="text-red-500">*</span></label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="text-sm w-72"><SelectValue placeholder="Select reason…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select reason —</SelectItem>
                {ABSENCE_REASONS.slice(1).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes…"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Upload evidence (optional)</label>
            <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-teal-400 hover:text-teal-600 transition-colors w-72">
              <Upload size={14} />
              {evidenceFile ? <span className="text-teal-700 font-medium">{evidenceFile}</span> : "Click to attach a file…"}
              <input type="file" className="hidden" onChange={(e) => setEvidenceFile(e.target.files?.[0]?.name ?? null)} />
            </label>
            <p className="text-[10px] text-gray-400 mt-1">Evidence will appear on the learner's Docs &amp; Comms tab (reference: "Evidence submitted by staff").</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep("dates")}>Back</Button>
            <Button className="bg-teal-700 hover:bg-teal-800" disabled={reason === "none"} onClick={() => setStep("review")}>
              Continue <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Review & submit */}
      {step === "review" && selectedLearner && (
        <div className="space-y-5">
          <h2 className="font-bold text-gray-800 text-base">Review &amp; submit</h2>

          {/* Attendance summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-600 mb-2">Learner attendance summary</p>
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-800">{selectedLearner.name}</span>
              <span className="text-xs text-gray-400 font-mono">{selectedLearner.personCode}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">Current attendance:</span>
              <span className={`text-sm font-bold ${parseInt(selectedLearner.attendance) < 80 ? "text-red-600" : "text-green-600"}`}>
                {selectedLearner.attendance}
              </span>
              {parseInt(selectedLearner.attendance) < 80 && (
                <span className="flex items-center gap-1 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                  <AlertTriangle size={10} /> Below 80% threshold
                </span>
              )}
            </div>
          </div>

          {/* Absence summary */}
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
            {[
              ["Absence reason", reason],
              ["Date(s)", dateType === "single"
                ? (partDay ? `${formatDate(singleDate)} (${startTime}–${endTime})` : formatDate(singleDate))
                : `${formatDate(rangeFrom)} – ${formatDate(rangeTo)}`],
              ["Type", dateType === "single" && partDay ? `Part day (${startTime}–${endTime})` : "Full day"],
              ["Notes", notes || "—"],
              ["Evidence", evidenceFile ?? "None"],
            ].map(([k, v]) => (
              <div key={k} className="px-4 py-2.5 flex gap-4">
                <span className="text-xs text-gray-500 w-28 shrink-0">{k}</span>
                <span className="text-gray-800">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep("reason")}>Back</Button>
            <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5" onClick={() => setSubmitted(true)}>
              <Check size={14} /> Submit Absence
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
