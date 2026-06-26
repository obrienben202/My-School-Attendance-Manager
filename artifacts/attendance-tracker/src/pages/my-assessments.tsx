import { useState } from "react";
import { useLocation } from "wouter";
import { useListAssessments, useListCourses, useCreateAssessment, useDeleteAssessment } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PenTool, Plus, Trash2, ChevronRight, ChevronsUpDown, X, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ASSESSMENT_TYPES = ["Assignment", "Exam", "Coursework", "Practical", "Portfolio", "Test", "Essay", "Presentation"];
const GRADING_SCHEMES = ["Percentage", "Marks Out Of", "Grade", "Pass/Fail", "Distinction/Merit/Pass"];

function AddAssessmentForm({ courseId, onSuccess, onCancel }: { courseId: number; onSuccess: () => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Assignment");
  const [dueDate, setDueDate] = useState("");
  const [gradingScheme, setGradingScheme] = useState("Percentage");
  const [minPassMark, setMinPassMark] = useState("");
  const [marksOutOf, setMarksOutOf] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [allowAegrotats, setAllowAegrotats] = useState(false);
  const [saving, setSaving] = useState(false);

  const { mutateAsync: createAssessment } = useCreateAssessment();

  async function handleSave() {
    if (!code.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await createAssessment({
        data: {
          courseId,
          code: code.trim(),
          description: description.trim(),
          type,
          dueDate: dueDate || null,
          gradingScheme,
          minPassMark: minPassMark || null,
          marksOutOf: marksOutOf ? parseInt(marksOutOf) : null,
          active: 1,
          order: 1,
          mandatory: mandatory ? 1 : 0,
          allowAegrotats: allowAegrotats ? 1 : 0,
        },
      });
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-teal-200 rounded bg-teal-50 p-4 space-y-3 mb-4">
      <p className="text-xs font-bold text-teal-800 uppercase tracking-wide">Add New Assessment</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Code *</label>
          <input value={code} onChange={e => setCode(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400" placeholder="e.g. UNIT1-ESSAY" />
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Description *</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400" placeholder="e.g. Unit 1 Essay" />
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Type</label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ASSESSMENT_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400" />
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Grading Scheme</label>
          <Select value={gradingScheme} onValueChange={setGradingScheme}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{GRADING_SCHEMES.map(g => <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Min Pass Mark</label>
          <input value={minPassMark} onChange={e => setMinPassMark(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400" placeholder="e.g. 40" />
        </div>
        {gradingScheme === "Marks Out Of" && (
          <div>
            <label className="text-xs text-slate-600 mb-1 block">Marks Out Of</label>
            <input type="number" value={marksOutOf} onChange={e => setMarksOutOf(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400" placeholder="e.g. 100" />
          </div>
        )}
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={mandatory} onChange={e => setMandatory(e.target.checked)} className="rounded" />
          Mandatory
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={allowAegrotats} onChange={e => setAllowAegrotats(e.target.checked)} className="rounded" />
          Allow Aegrotats
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || !code.trim() || !description.trim()}
          className="flex items-center gap-1 text-xs bg-teal-700 text-white rounded px-3 py-1.5 hover:bg-teal-800 disabled:opacity-50">
          <Check className="w-3 h-3" /> {saving ? "Saving…" : "Save Assessment"}
        </button>
        <button onClick={onCancel} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function MyAssessments() {
  const [, navigate] = useLocation();
  const [filterText, setFilterText] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: courses, isLoading: isCoursesLoading } = useListCourses();
  const { data: assessments, isLoading: isAssessmentsLoading, refetch } = useListAssessments(
    selectedCourseId ? { courseId: selectedCourseId } : {},
    { query: {} as any }
  );
  const { mutateAsync: deleteAssessment } = useDeleteAssessment();

  const filtered = (assessments ?? []).filter(a =>
    !filterText || (a.code + " " + a.description).toLowerCase().includes(filterText.toLowerCase())
  );

  async function handleDelete(id: number) {
    if (!confirm("Delete this assessment? This cannot be undone.")) return;
    await deleteAssessment({ id });
    refetch();
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PenTool className="w-5 h-5 text-teal-700" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">My Assessments</h1>
            <p className="text-xs text-slate-500">View and mark learner assessments</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 text-xs bg-teal-700 text-white rounded px-3 py-1.5 hover:bg-teal-800"
        >
          <Plus className="w-3.5 h-3.5" /> Add Assessment
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded p-4">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Filter Assessments</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs text-slate-600">Course</span>
            <Select value={selectedCourseId?.toString() ?? "all"} onValueChange={v => setSelectedCourseId(v === "all" ? null : parseInt(v))}>
              <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="All courses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Courses</SelectItem>
                {(courses ?? []).map(c => <SelectItem key={c.id} value={c.id.toString()} className="text-xs">{c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs text-slate-600">Search</span>
            <input value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Filter by code or description…"
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-teal-400 h-8" />
          </div>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && selectedCourseId && (
        <AddAssessmentForm
          courseId={selectedCourseId}
          onSuccess={() => { setShowAddForm(false); refetch(); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
      {showAddForm && !selectedCourseId && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
          Select a course first before adding an assessment.
        </div>
      )}

      {/* Results table */}
      <div className="border border-slate-300 rounded overflow-hidden">
        <div className="bg-slate-700 text-white px-4 py-2 font-semibold text-sm flex items-center justify-between">
          <span>Assessments</span>
          <span className="text-xs font-normal opacity-75">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        {isAssessmentsLoading || isCoursesLoading ? (
          <div className="p-4 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Code", "Description", "Type", "Due Date", "Grading Scheme", "Min Pass", "Mandatory", "Active", "Mark", "Confirm", ""].map(col => (
                  <th key={col} className="text-left font-semibold text-slate-600 px-3 py-2">
                    {col && <span className="flex items-center gap-1 cursor-pointer hover:text-slate-900">
                      {col} {!["Mark", "Confirm", ""].includes(col) && <ChevronsUpDown className="w-3 h-3 opacity-50" />}
                    </span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  {assessments?.length === 0
                    ? "No assessments found. Click 'Add Assessment' to create one."
                    : "No assessments match your filter."}
                </td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">
                    <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3 text-slate-400" />{a.code}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{a.description}</td>
                  <td className="px-3 py-2 text-slate-500">{a.type}</td>
                  <td className="px-3 py-2 text-slate-500">{a.dueDate ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{a.gradingScheme}</td>
                  <td className="px-3 py-2 text-slate-500">{a.minPassMark ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{a.mandatory ? "✓" : "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-semibold ${a.active ? "text-emerald-700" : "text-slate-400"}`}>{a.active ? "Yes" : "No"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => navigate(`/assessments/${a.id}`)}
                      className="text-sky-700 underline text-xs hover:text-sky-900">Mark</button>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => navigate(`/assessments/${a.id}?confirm=1`)}
                      className="text-teal-700 underline text-xs hover:text-teal-900">Confirm</button>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleDelete(a.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex justify-between text-xs text-slate-500">
          <span>Showing {filtered.length} of {assessments?.length ?? 0} assessments</span>
          <div className="flex gap-1">
            <button className="w-6 h-6 rounded border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>‹</button>
            <button className="w-6 h-6 rounded border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
