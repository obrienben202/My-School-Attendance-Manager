import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetAssessment,
  useListAssessmentResults,
  useListStudents,
  useCreateAssessmentResult,
  useUpdateAssessmentResult,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, RotateCcw, X } from "lucide-react";
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

type LocalResult = {
  id?: number;
  result: string;
  adjustedResult: string;
  attempt: number;
  status: string;
  reasonForZeroMark: string;
  mitigatingCircs: string;
  dateSubmitted: string;
  dateMarked: string;
  confirmed: number;
  resitting: boolean;
};

export default function AssignmentResults() {
  const params = useParams();
  const [, navigate] = useLocation();
  const id = parseInt(params.id || "0", 10);

  const { data: assessment, isLoading: isAssessmentLoading } = useGetAssessment(id, { query: { enabled: !!id } as any });
  const { data: students, isLoading: isStudentsLoading } = useListStudents();
  const { data: existingResults, refetch } = useListAssessmentResults(
    { assessmentId: id },
    { query: { enabled: !!id } as any }
  );

  const { mutateAsync: createResult } = useCreateAssessmentResult();
  const { mutateAsync: updateResult } = useUpdateAssessmentResult();

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [localResults, setLocalResults] = useState<Record<number, LocalResult>>({});
  const [groupFilter, setGroupFilter] = useState("all");
  const [bulkResitSelected, setBulkResitSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [extensionStudentId, setExtensionStudentId] = useState<number | null>(null);
  const [extensionDate, setExtensionDate] = useState("");

  if (isAssessmentLoading || isStudentsLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!assessment) {
    return <div className="p-12 text-center text-muted-foreground">Assignment/group not found.</div>;
  }

  const enrolledStudents = students ?? [];

  function toggleExpanded(sid: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  }

  function getResult(studentId: number): LocalResult {
    if (localResults[studentId]) return localResults[studentId];
    const existing = existingResults?.find(r => r.studentId === studentId);
    return {
      id: existing?.id,
      result: existing?.result ?? "",
      adjustedResult: existing?.adjustedResult ?? "",
      attempt: existing?.attempt ?? 1,
      status: existing?.status ?? "Not Marked",
      reasonForZeroMark: existing?.reasonForZeroMark ?? "",
      mitigatingCircs: existing?.mitigatingCircs ?? "",
      dateSubmitted: existing?.dateSubmitted ?? "",
      dateMarked: existing?.dateMarked ?? "",
      confirmed: existing?.confirmed ?? 0,
      resitting: false,
    };
  }

  function setField(studentId: number, field: keyof LocalResult, value: string | number | boolean) {
    setLocalResults(prev => ({
      ...prev,
      [studentId]: { ...getResult(studentId), [field]: value },
    }));
  }

  function handleResit(studentId: number) {
    const r = getResult(studentId);
    setLocalResults(prev => ({
      ...prev,
      [studentId]: { ...r, result: "", adjustedResult: "", attempt: r.attempt + 1, status: "Not Marked", resitting: true },
    }));
    setExpandedIds(prev => new Set([...prev, studentId]));
  }

  function handleCancelResit(studentId: number) {
    const r = getResult(studentId);
    const existing = existingResults?.find(e => e.studentId === studentId);
    setLocalResults(prev => ({
      ...prev,
      [studentId]: {
        ...r,
        result: existing?.result ?? "",
        adjustedResult: existing?.adjustedResult ?? "",
        attempt: Math.max(1, r.attempt - 1),
        status: existing?.status ?? "Not Marked",
        resitting: false,
      },
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

  async function handleBulkResitSelected() {
    bulkResitSelected.forEach(sid => handleResit(sid));
    setBulkResitSelected(new Set());
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/assignments-groups")} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-3.5 h-3.5" /> My Assignments / Groups
        </button>
        <span className="text-xs text-slate-400">/</span>
        <span className="text-xs text-slate-700">{assessment.code}</span>
      </div>

      {/* Submit banner */}
      {submitted && (
        <div className="flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded">
          <Check className="w-4 h-4" /> Results submitted successfully.
        </div>
      )}

      {/* Confirm modal */}
      {confirmed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-teal-700 px-5 py-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-white" />
              <p className="text-sm font-semibold text-white">Assessment Confirmed</p>
            </div>
            <div className="px-5 py-5 space-y-3">
              <p className="text-sm text-slate-700">
                The assessment results for <span className="font-semibold">{assessment.code}</span> have been confirmed successfully.
              </p>
              <p className="text-xs text-slate-500">All learner results have been set to Confirmed status.</p>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => { setConfirmed(false); navigate("/assignments-groups"); }}
                className="text-xs bg-teal-700 text-white rounded px-4 py-1.5 hover:bg-teal-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Module Details */}
      <div className="bg-white border border-slate-200 rounded">
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Module Details</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Group:</span>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="h-6 text-xs w-36"><SelectValue placeholder="All Groups" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Groups</SelectItem>
                <SelectItem value="A" className="text-xs">Group A</SelectItem>
                <SelectItem value="B" className="text-xs">Group B</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="px-5 py-4 grid grid-cols-3 gap-x-8 gap-y-1 text-xs">
          <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Assessment Code</span><span className="text-slate-900">{assessment.code}</span></div>
          <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Description</span><span className="text-slate-900">{assessment.description}</span></div>
          <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Type</span><span className="text-slate-900">{assessment.type}</span></div>
          <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Due Date</span><span className="text-slate-900">{assessment.dueDate ?? "—"}</span></div>
          <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Grading Scheme</span><span className="text-slate-900">{assessment.gradingScheme}</span></div>
          <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Min Pass Mark</span><span className="text-slate-900">{assessment.minPassMark ?? "—"}</span></div>
          {assessment.marksOutOf && <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Marks Out Of</span><span className="text-slate-900">{assessment.marksOutOf}</span></div>}
          <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">Order</span><span className="text-slate-900">{assessment.order}</span></div>
        </div>
      </div>

      {/* Extension banner */}
      {extensionStudentId && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-center gap-3">
          <span className="text-xs text-amber-800 font-semibold">
            Grant extension for {enrolledStudents.find(s => s.id === extensionStudentId)?.forename}:
          </span>
          <input type="date" value={extensionDate} onChange={e => setExtensionDate(e.target.value)}
            className="border border-amber-300 rounded px-2 py-1 text-xs outline-none" />
          <button onClick={() => { setExtensionStudentId(null); setExtensionDate(""); }}
            className="text-xs bg-amber-600 text-white rounded px-2 py-1 hover:bg-amber-700">Set Extension</button>
          <button onClick={() => setExtensionStudentId(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Record Assignment Results table */}
      <div className="bg-white border border-slate-200 rounded">
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
            Record Assignment Results — {enrolledStudents.length} Learners
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" onChange={e => {
                    if (e.target.checked) setBulkResitSelected(new Set(enrolledStudents.map(s => s.id)));
                    else setBulkResitSelected(new Set());
                  }} />
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Learner</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Date of Birth</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-32">Result</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 w-32">Adjusted Result</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600 w-16">Attempt</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600 w-24">Bulk Resit</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600 w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrolledStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No learners enrolled on this assessment's course.
                  </td>
                </tr>
              ) : enrolledStudents.map(s => {
                const r = getResult(s.id);
                const isExpanded = expandedIds.has(s.id);
                const isBulk = bulkResitSelected.has(s.id);

                return (
                  <>
                    {/* Learner summary row — click to expand */}
                    <tr
                      key={`row-${s.id}`}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => toggleExpanded(s.id)}
                    >
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isBulk} disabled={!r.result}
                          onChange={e => {
                            const next = new Set(bulkResitSelected);
                            e.target.checked ? next.add(s.id) : next.delete(s.id);
                            setBulkResitSelected(next);
                          }} />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        <span className="flex items-center gap-1.5">
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/students/${s.id}`); }}
                            className="text-sky-700 hover:underline"
                          >
                            {s.forename} {s.surname}
                          </button>
                          {s.atRisk && <AlertTriangle className="w-3 h-3 text-red-500" />}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{s.dateOfBirth ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium">{r.result || <span className="text-slate-300 italic">—</span>}</td>
                      <td className="px-3 py-2 text-slate-500">{r.adjustedResult || <span className="text-slate-300 italic">—</span>}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{r.attempt}</td>
                      <td className="px-3 py-2 text-center text-slate-400">{isBulk ? "✓" : "—"}</td>
                      <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${
                          r.status === "Submitted" ? "bg-emerald-100 text-emerald-700" :
                          r.status === "Confirmed" ? "bg-teal-100 text-teal-700" :
                          r.status === "Referred" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>{r.status}</span>
                      </td>
                    </tr>

                    {/* Expanded assessment entry row */}
                    {isExpanded && (
                      <tr key={`expanded-${s.id}`} className="border-b border-slate-200 bg-slate-50">
                        <td />
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Left: Result inputs */}
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                                {assessment.code} — Enter Results
                              </p>
                              <div className="flex items-center gap-3">
                                <label className="w-28 shrink-0 text-xs text-slate-500">Result</label>
                                <input
                                  value={r.result}
                                  onChange={e => setField(s.id, "result", e.target.value)}
                                  placeholder={assessment.gradingScheme === "Percentage" ? "0–100" : assessment.gradingScheme === "Grade" ? "A–F" : ""}
                                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400"
                                />
                              </div>
                              <div className="flex items-center gap-3">
                                <label className="w-28 shrink-0 text-xs text-slate-500">Adjusted Result</label>
                                <input
                                  value={r.adjustedResult}
                                  onChange={e => setField(s.id, "adjustedResult", e.target.value)}
                                  placeholder="Adjusted…"
                                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400"
                                />
                              </div>
                              <div className="flex items-center gap-3">
                                <label className="w-28 shrink-0 text-xs text-slate-500">Attempt</label>
                                <span className="text-xs font-semibold text-slate-800">{r.attempt}</span>
                              </div>
                              <div className="flex gap-2 mt-2">
                                {!r.resitting ? (
                                  <button
                                    onClick={() => handleResit(s.id)}
                                    disabled={!r.result}
                                    className="text-xs border border-amber-400 text-amber-700 rounded px-3 py-1 hover:bg-amber-50 disabled:opacity-40"
                                  >
                                    Resit
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleCancelResit(s.id)}
                                    className="flex items-center gap-1 text-xs border border-slate-300 text-slate-600 rounded px-3 py-1 hover:bg-slate-100"
                                  >
                                    <RotateCcw className="w-3 h-3" /> Cancel
                                  </button>
                                )}
                                <button
                                  onClick={() => setExtensionStudentId(s.id)}
                                  className="text-xs border border-slate-300 text-slate-600 rounded px-3 py-1 hover:bg-slate-100"
                                >
                                  Grant Extension
                                </button>
                              </div>
                            </div>

                            {/* Right: Assessment details */}
                            <div className="space-y-3 border-l border-slate-200 pl-4">
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Assessment Details</p>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Reason for Zero Mark</p>
                                <Select value={r.reasonForZeroMark} onValueChange={v => setField(s.id, "reasonForZeroMark", v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                                  <SelectContent>
                                    {ZERO_MARK_REASONS.map(reason => (
                                      <SelectItem key={reason} value={reason} className="text-xs">{reason}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Mitigating Circumstances</p>
                                <Select value={r.mitigatingCircs} onValueChange={v => setField(s.id, "mitigatingCircs", v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                                  <SelectContent>
                                    {MITIGATING_CIRCS.map(m => (
                                      <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Date Submitted</p>
                                <input type="date" value={r.dateSubmitted}
                                  onChange={e => setField(s.id, "dateSubmitted", e.target.value)}
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400" />
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Date Marked</p>
                                <input type="date" value={r.dateMarked}
                                  onChange={e => setField(s.id, "dateMarked", e.target.value)}
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400" />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex gap-2 flex-wrap">
          <button
            onClick={handleSubmitResults}
            disabled={saving || submitted}
            className="flex items-center gap-1.5 text-xs bg-teal-700 text-white rounded px-3 py-1.5 hover:bg-teal-800 disabled:opacity-50"
          >
            <Check className="w-3 h-3" /> {saving ? "Submitting…" : "Submit Results"}
          </button>
          {bulkResitSelected.size > 0 && (
            <button
              onClick={handleBulkResitSelected}
              className="flex items-center gap-1.5 text-xs bg-amber-600 text-white rounded px-3 py-1.5 hover:bg-amber-700"
            >
              Resit Selected ({bulkResitSelected.size})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
