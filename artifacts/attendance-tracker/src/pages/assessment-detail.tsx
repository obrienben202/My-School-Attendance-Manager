import { useState } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import {
  useGetAssessment,
  useListAssessmentResults,
  useListStudents,
  useCreateAssessmentResult,
  useUpdateAssessmentResult,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, AlertTriangle, RotateCcw, ChevronLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ZERO_MARK_REASONS = [
  "Non-submission",
  "Academic Misconduct",
  "Late Submission",
  "Technical Failure",
  "Medical (Pending)",
  "Other",
];
const MITIGATING_CIRCS = [
  "Illness",
  "Bereavement",
  "Family Emergency",
  "Mental Health",
  "Accident / Injury",
  "Other",
];
const STATUSES = ["Not Marked", "Marked", "Submitted", "Confirmed", "Referred"];

type LocalResult = {
  id?: number;
  result: string;
  adjustedResult: string;
  attempt: number;
  reasonForZeroMark: string;
  mitigatingCircs: string;
  dateSubmitted: string;
  dateMarked: string;
  confirmed: number;
  status: string;
};

export default function AssessmentDetail() {
  const params = useParams();
  const search = useSearch();
  const [, navigate] = useLocation();
  const isConfirmMode = new URLSearchParams(search).get("confirm") === "1";
  const id = parseInt(params.id || "0", 10);

  const { data: assessment, isLoading: isAssessmentLoading } = useGetAssessment(id, { query: { enabled: !!id } as any });
  const { data: students, isLoading: isStudentsLoading } = useListStudents();
  const { data: existingResults, refetch } = useListAssessmentResults(
    { assessmentId: id },
    { query: { enabled: !!id } as any }
  );

  const { mutateAsync: createResult } = useCreateAssessmentResult();
  const { mutateAsync: updateResult } = useUpdateAssessmentResult();

  const [localResults, setLocalResults] = useState<Record<number, LocalResult>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [extensionStudentId, setExtensionStudentId] = useState<number | null>(null);
  const [extensionDate, setExtensionDate] = useState("");
  const [bulkResitSelected, setBulkResitSelected] = useState<Set<number>>(new Set());

  if (isAssessmentLoading || isStudentsLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!assessment) {
    return <div className="p-12 text-center text-muted-foreground">Assessment not found.</div>;
  }

  const enrolledStudents = students ?? [];

  function getResult(studentId: number): LocalResult {
    if (localResults[studentId]) return localResults[studentId];
    const existing = existingResults?.find(r => r.studentId === studentId);
    return {
      id: existing?.id,
      result: existing?.result ?? "",
      adjustedResult: existing?.adjustedResult ?? "",
      attempt: existing?.attempt ?? 1,
      reasonForZeroMark: existing?.reasonForZeroMark ?? "",
      mitigatingCircs: existing?.mitigatingCircs ?? "",
      dateSubmitted: existing?.dateSubmitted ?? "",
      dateMarked: existing?.dateMarked ?? "",
      confirmed: existing?.confirmed ?? 0,
      status: existing?.status ?? "Not Marked",
    };
  }

  function setField(studentId: number, field: keyof LocalResult, value: string | number) {
    setLocalResults(prev => ({
      ...prev,
      [studentId]: { ...getResult(studentId), [field]: value },
    }));
  }

  async function handleSubmitResults() {
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    try {
      for (const s of enrolledStudents) {
        const r = localResults[s.id];
        if (!r) continue;
        const payload = {
          assessmentId: id,
          studentId: s.id,
          result: r.result || null,
          adjustedResult: r.adjustedResult || null,
          attempt: r.attempt,
          reasonForZeroMark: r.reasonForZeroMark || null,
          mitigatingCircs: r.mitigatingCircs || null,
          dateSubmitted: r.dateSubmitted || today,
          dateMarked: r.dateMarked || today,
          confirmed: 0,
          status: "Submitted",
        };
        if (r.id) {
          await updateResult({ id: r.id, data: payload });
        } else {
          await createResult({ data: payload });
        }
      }
      setSubmitted(true);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmResults() {
    setSaving(true);
    try {
      for (const r of existingResults ?? []) {
        await updateResult({ id: r.id, data: { ...r, confirmed: 1, status: "Confirmed" } });
      }
      setConfirmed(true);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleResit(studentId: number) {
    const r = getResult(studentId);
    setLocalResults(prev => ({
      ...prev,
      [studentId]: { ...r, result: "", adjustedResult: "", attempt: r.attempt + 1, status: "Not Marked" },
    }));
  }

  async function handleRevert(studentId: number) {
    const r = getResult(studentId);
    if (r.attempt <= 1) return;
    setLocalResults(prev => ({
      ...prev,
      [studentId]: { ...r, result: "", adjustedResult: "", attempt: r.attempt - 1 },
    }));
  }

  const selectedStudent = selectedStudentId ? enrolledStudents.find(s => s.id === selectedStudentId) : null;
  const selectedResult = selectedStudentId ? getResult(selectedStudentId) : null;

  const pageTitle = isConfirmMode ? "Confirm Assessment Results" : "Record Assessment Results";

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/assessments")} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-3.5 h-3.5" /> My Assessments
        </button>
        <span className="text-xs text-slate-400">/</span>
        <span className="text-xs text-slate-700">{assessment.code}</span>
      </div>

      {/* Status banners */}
      {submitted && !isConfirmMode && (
        <div className="flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded">
          <Check className="w-4 h-4" /> Results submitted successfully.
        </div>
      )}
      {confirmed && (
        <div className="flex items-center gap-2 bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded">
          <Check className="w-4 h-4" /> Assessment results confirmed.
        </div>
      )}

      <div className="flex gap-4">
        {/* Main panel */}
        <div className="flex-1 space-y-4">
          {/* Module Details */}
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Module Details</p>
              {groupFilter !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Group:</span>
                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="h-6 text-xs w-36"><SelectValue placeholder="All Groups" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">All Groups</SelectItem>
                      <SelectItem value="A" className="text-xs">Group A</SelectItem>
                      <SelectItem value="B" className="text-xs">Group B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="px-5 py-4 grid grid-cols-3 gap-x-8 gap-y-1 text-xs">
              <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Assessment Code</span><span className="text-slate-900">{assessment.code}</span></div>
              <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Description</span><span className="text-slate-900">{assessment.description}</span></div>
              <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Type</span><span className="text-slate-900">{assessment.type}</span></div>
              <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Due Date</span><span className="text-slate-900">{assessment.dueDate ?? "—"}</span></div>
              <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Grading Scheme</span><span className="text-slate-900">{assessment.gradingScheme}</span></div>
              <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Min Pass Mark</span><span className="text-slate-900">{assessment.minPassMark ?? "—"}</span></div>
              {assessment.marksOutOf && <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Marks Out Of</span><span className="text-slate-900">{assessment.marksOutOf}</span></div>}
              <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Mandatory</span><span className="text-slate-900">{assessment.mandatory ? "Yes" : "No"}</span></div>
              <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Allow Aegrotats</span><span className="text-slate-900">{assessment.allowAegrotats ? "Yes" : "No"}</span></div>
            </div>
          </div>

          {/* Grant Extension banner */}
          {extensionStudentId && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-center gap-3">
              <span className="text-xs text-amber-800 font-semibold">Grant extension for {enrolledStudents.find(s => s.id === extensionStudentId)?.forename}:</span>
              <input type="date" value={extensionDate} onChange={e => setExtensionDate(e.target.value)}
                className="border border-amber-300 rounded px-2 py-1 text-xs outline-none" />
              <button onClick={() => { setExtensionStudentId(null); setExtensionDate(""); }}
                className="text-xs bg-amber-600 text-white rounded px-2 py-1 hover:bg-amber-700">Set Extension</button>
              <button onClick={() => setExtensionStudentId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {/* Results table */}
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{pageTitle} — {enrolledStudents.length} Learners</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 w-8">
                      {!isConfirmMode && <input type="checkbox" onChange={e => {
                        if (e.target.checked) setBulkResitSelected(new Set(enrolledStudents.map(s => s.id)));
                        else setBulkResitSelected(new Set());
                      }} />}
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Learner</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Date of Birth</th>
                    {!isConfirmMode && <>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-32">Result</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-32">Adjusted Result</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-600 w-16">Attempt</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-600 w-24">Bulk Resit</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-600 w-20">Actions</th>
                    </>}
                    {isConfirmMode && <>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Result</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-36">Status</th>
                    </>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrolledStudents.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No learners enrolled on this assessment's course.</td></tr>
                  ) : enrolledStudents.map(s => {
                    const r = getResult(s.id);
                    const isBulk = bulkResitSelected.has(s.id);
                    return (
                      <tr key={s.id}
                        className={`hover:bg-slate-50 cursor-pointer ${selectedStudentId === s.id ? "bg-teal-50" : ""}`}
                        onClick={() => setSelectedStudentId(selectedStudentId === s.id ? null : s.id)}
                      >
                        <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                          {!isConfirmMode && (
                            <input type="checkbox" checked={isBulk} disabled={!r.result}
                              onChange={e => {
                                const next = new Set(bulkResitSelected);
                                e.target.checked ? next.add(s.id) : next.delete(s.id);
                                setBulkResitSelected(next);
                              }}
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <button onClick={e => { e.stopPropagation(); navigate(`/students/${s.id}`); }}
                            className="text-sky-700 hover:underline font-medium">
                            {s.forename} {s.surname}
                          </button>
                          {s.atRisk && <AlertTriangle className="inline w-3 h-3 text-red-500 ml-1" />}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500">{s.dateOfBirth ?? "—"}</td>
                        {!isConfirmMode && <>
                          <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                            <input value={r.result} onChange={e => setField(s.id, "result", e.target.value)}
                              disabled={confirmed}
                              placeholder={assessment.gradingScheme === "Percentage" ? "0-100" : assessment.gradingScheme === "Grade" ? "A-F" : ""}
                              className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-50 disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                            <input value={r.adjustedResult} onChange={e => setField(s.id, "adjustedResult", e.target.value)}
                              disabled={confirmed}
                              placeholder="Adjusted…"
                              className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-50 disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center font-semibold text-slate-700">{r.attempt}</td>
                          <td className="px-3 py-1.5 text-center text-slate-400">{isBulk ? "✓" : "—"}</td>
                          <td className="px-3 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button title="Resit" onClick={() => handleResit(s.id)} disabled={!r.result || confirmed}
                                className="text-xs text-amber-600 hover:text-amber-800 disabled:opacity-30">Resit</button>
                              <button title="Revert" onClick={() => handleRevert(s.id)} disabled={r.attempt <= 1 || confirmed}
                                className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </>}
                        {isConfirmMode && <>
                          <td className="px-3 py-1.5 font-semibold text-slate-800">{r.result || "—"}</td>
                          <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                            <Select value={r.status} onValueChange={v => setField(s.id, "status", v)} disabled={confirmed}>
                              <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{STATUSES.map(st => <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Action buttons */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex gap-2 flex-wrap">
              {!isConfirmMode && <>
                <button onClick={() => setExtensionStudentId(selectedStudentId)}
                  disabled={!selectedStudentId}
                  className="flex items-center gap-1.5 text-xs border border-slate-300 bg-white rounded px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">
                  Grant Extension
                </button>
                <button onClick={handleSubmitResults} disabled={saving || confirmed}
                  className="flex items-center gap-1.5 text-xs bg-teal-700 text-white rounded px-3 py-1.5 hover:bg-teal-800 disabled:opacity-50">
                  <Check className="w-3 h-3" /> {saving ? "Submitting…" : "Submit Results"}
                </button>
                {bulkResitSelected.size > 0 && (
                  <button onClick={() => { bulkResitSelected.forEach(sid => handleResit(sid)); setBulkResitSelected(new Set()); }}
                    className="flex items-center gap-1.5 text-xs bg-amber-600 text-white rounded px-3 py-1.5 hover:bg-amber-700">
                    Resit Selected ({bulkResitSelected.size})
                  </button>
                )}
              </>}
              {isConfirmMode && (
                <button onClick={handleConfirmResults} disabled={saving || confirmed}
                  className="flex items-center gap-1.5 text-xs bg-teal-700 text-white rounded px-3 py-1.5 hover:bg-teal-800 disabled:opacity-50">
                  <Check className="w-3 h-3" /> {saving ? "Confirming…" : "Confirm Results"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Assessment Details side pane */}
        {selectedStudent && selectedResult && (
          <div className="w-64 shrink-0">
            <div className="bg-white border border-slate-200 rounded sticky top-4">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Assessment Details</p>
                <button onClick={() => setSelectedStudentId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="px-4 py-3 space-y-3 text-xs">
                <div>
                  <p className="text-slate-500 mb-0.5">Learner</p>
                  <button onClick={() => navigate(`/students/${selectedStudent.id}`)} className="text-sky-700 hover:underline font-medium">
                    {selectedStudent.forename} {selectedStudent.surname}
                  </button>
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5">Date of Birth</p>
                  <p className="text-slate-900">{selectedStudent.dateOfBirth ?? "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5">Past Results</p>
                  <p className="text-slate-400 italic">{selectedResult.result ? `Previous: ${selectedResult.result}` : "No past results"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Reason for Zero Mark</p>
                  <Select value={selectedResult.reasonForZeroMark} onValueChange={v => setField(selectedStudent.id, "reasonForZeroMark", v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                    <SelectContent>{ZERO_MARK_REASONS.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Mitigating Circumstances</p>
                  <Select value={selectedResult.mitigatingCircs} onValueChange={v => setField(selectedStudent.id, "mitigatingCircs", v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{MITIGATING_CIRCS.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Date Submitted</p>
                  <input type="date" value={selectedResult.dateSubmitted}
                    onChange={e => setField(selectedStudent.id, "dateSubmitted", e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400" />
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Date Marked</p>
                  <input type="date" value={selectedResult.dateMarked}
                    onChange={e => setField(selectedStudent.id, "dateMarked", e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400" />
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5">Current Status</p>
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${
                    selectedResult.status === "Confirmed" ? "bg-teal-100 text-teal-700" :
                    selectedResult.status === "Submitted" ? "bg-emerald-100 text-emerald-700" :
                    selectedResult.status === "Referred" ? "bg-red-100 text-red-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>{selectedResult.status}</span>
                </div>
                {extensionStudentId === selectedStudent.id && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800">Extension set: {extensionDate || "pending"}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
