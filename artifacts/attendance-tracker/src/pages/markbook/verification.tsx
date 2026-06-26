import { useState } from "react";
import { useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, CheckCircle2, SlidersHorizontal, Upload, AlertTriangle } from "lucide-react";

// ─── Reference data ────────────────────────────────────────────────────────────

const ACADEMIC_YEARS = ["2024/25", "2023/24", "2022/23"];
const SUBJECTS = ["Level 3 BTEC Extended Diploma", "GCSE English Language", "A Level Mathematics", "Access to HE Science"];
const UNITS_MAP: Record<string, string[]> = {
  "Level 3 BTEC Extended Diploma": ["Unit 1: Research Methods", "Unit 2: Data Analysis", "Unit 3: Workplace Practice", "Unit 4: Project Work"],
  "GCSE English Language": ["Component 1: Creative Reading", "Component 2: Writers' Viewpoints"],
  "A Level Mathematics": ["Pure 1", "Pure 2", "Statistics"],
  "Access to HE Science": ["Unit 1: Scientific Thinking", "Unit 2: Biology", "Unit 3: Chemistry"],
};

type UnitResult = {
  grade: string;
  score: string;
  forVerification: boolean;
  verified: boolean;
  released: boolean;
};
type LearnerRow = {
  id: number;
  name: string;
  personCode: string;
  withdrawn: boolean;
  units: Record<number, UnitResult>;
};

function buildRows(students: { id: number; forename: string; surname: string; personCode?: string | null }[], unitCount: number): LearnerRow[] {
  const grades = ["A", "B", "Distinction", "Merit", "Pass", "C", "", "A*"];
  return students.map((s, si) => {
    const units: Record<number, UnitResult> = {};
    for (let u = 0; u < unitCount; u++) {
      const grade = grades[(si + u) % grades.length];
      const score = grade ? String(55 + ((si + u) * 7) % 40) : "";
      units[u] = {
        grade,
        score,
        forVerification: false,
        verified: grade !== "" && (si + u) % 4 === 0,
        released: grade !== "" && (si + u) % 8 === 0,
      };
    }
    return {
      id: s.id,
      name: `${s.surname}, ${s.forename}`,
      personCode: s.personCode ?? `PC${s.id}`,
      withdrawn: si % 7 === 0,
      units,
    };
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function MarkbookVerification() {
  const { data: students = [] } = useListStudents();

  const [academicYear, setAcademicYear] = useState("2024/25");
  const [subject, setSubject] = useState("none");
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [excludeWithdrawn, setExcludeWithdrawn] = useState(false);
  const [perLearner, setPerLearner] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [rows, setRows] = useState<LearnerRow[]>([]);
  const [updatedCells, setUpdatedCells] = useState<Set<string>>(new Set());
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [released, setReleased] = useState(false);

  const units = subject !== "none" ? (UNITS_MAP[subject] ?? []) : [];

  const doSearch = () => {
    if (subject === "none") return;
    setRows(buildRows(students, units.length));
    setUpdatedCells(new Set());
    setGridVisible(true);
  };

  const clearFilters = () => { setGridVisible(false); setSubject("none"); setOnlyUnverified(false); setExcludeWithdrawn(false); };

  const updateCell = (lid: number, uid: number, patch: Partial<UnitResult>) => {
    setRows((prev) => prev.map((r) => r.id === lid
      ? { ...r, units: { ...r.units, [uid]: { ...r.units[uid], ...patch } } }
      : r
    ));
    setUpdatedCells((prev) => new Set(prev).add(`${lid}-${uid}`));
  };

  const fillColumn = (uid: number, field: "grade" | "score", value: string) => {
    setRows((prev) => prev.map((r) => {
      if (r.units[uid]?.released) return r;
      setUpdatedCells((p) => new Set(p).add(`${r.id}-${uid}`));
      return { ...r, units: { ...r.units, [uid]: { ...r.units[uid], [field]: value } } };
    }));
  };

  const handleSubmit = () => {
    setRows((prev) => prev.map((r) => {
      const units = { ...r.units };
      Object.keys(units).forEach((k) => {
        const u = units[Number(k)];
        if (u.forVerification) units[Number(k)] = { ...u, verified: true, forVerification: false };
      });
      return { ...r, units };
    }));
    setUpdatedCells(new Set());
  };

  const handleReleaseAll = () => {
    setRows((prev) => prev.map((r) => {
      const units = { ...r.units };
      Object.keys(units).forEach((k) => {
        const u = units[Number(k)];
        if (u.verified) units[Number(k)] = { ...u, released: true };
      });
      return { ...r, units };
    }));
    setReleased(true);
    setShowReleaseConfirm(false);
  };

  const visibleRows = rows.filter((r) => {
    if (excludeWithdrawn && r.withdrawn) return false;
    if (onlyUnverified) {
      const hasUnverified = units.some((_, ui) => !r.units[ui]?.verified);
      if (!hasUnverified) return false;
    }
    return true;
  });

  return (
    <div className="space-y-0 -mx-6 -mt-6">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-gray-900">Markbook Verification</h1>
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded font-medium">
              Role: Exams Synchronisation
            </span>
          </div>
          <p className="text-sm text-gray-500">Verify individual grades for subjects with multiple units. Requires the Exams Synchronisation role.</p>
        </div>
        {gridVisible && !released && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleSubmit}
            >
              <Check size={13} /> Submit
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-green-700 hover:bg-green-800"
              onClick={() => setShowReleaseConfirm(true)}
            >
              <Upload size={13} /> Release all verified units
            </Button>
          </div>
        )}
        {released && (
          <div className="flex items-center gap-2 text-sm text-green-700 font-medium bg-green-50 border border-green-200 rounded px-3 py-1.5">
            <CheckCircle2 size={16} /> All verified grades released to learners
          </div>
        )}
      </div>

      {/* Filter panel */}
      {!gridVisible && (
        <div className="px-6 py-5 bg-slate-50 border-b border-gray-200">
          <div className="max-w-2xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Academic Year <span className="text-red-500">*</span></label>
                <Select value={academicYear} onValueChange={setAcademicYear}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Subject <span className="text-red-500">*</span></label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select subject…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select subject —</SelectItem>
                    {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <Toggle label="Only show learners with unverified grades" checked={onlyUnverified} onChange={setOnlyUnverified} />
              <Toggle label="Exclude withdrawn learners" checked={excludeWithdrawn} onChange={setExcludeWithdrawn} />
            </div>
            <Button className="bg-teal-700 hover:bg-teal-800 gap-2" onClick={doSearch} disabled={subject === "none"}>
              <SlidersHorizontal size={14} /> Search
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {gridVisible && (
        <div>
          {/* Active filter bar */}
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 text-gray-600">
              <span className="font-semibold text-amber-800">{academicYear}</span>
              <span className="text-gray-400">·</span>
              <span>{subject}</span>
              {onlyUnverified && <span className="text-amber-700 font-medium">· Unverified only</span>}
              {excludeWithdrawn && <span className="text-amber-700 font-medium">· Withdrawn excluded</span>}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perLearner}
                  onChange={(e) => setPerLearner(e.target.checked)}
                  className="rounded"
                />
                Option to verify individual grades
              </label>
              <button className="text-teal-700 hover:text-teal-900 font-semibold underline" onClick={clearFilters}>
                Clear all filters
              </button>
            </div>
          </div>

          {released && (
            <div className="px-6 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 flex items-center gap-2">
              <CheckCircle2 size={13} /> Grades have been released to learners. Released grades cannot be edited.
            </div>
          )}

          <div className="overflow-auto">
            <table className="border-collapse min-w-full text-xs">
              <thead>
                {/* Unit headers */}
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="sticky left-0 z-20 bg-gray-100 border-r-2 border-gray-300 px-4 py-2.5 text-left font-bold text-gray-700 min-w-[180px]">
                    Learner
                  </th>
                  {units.map((unit, ui) => (
                    <th key={ui} colSpan={perLearner ? 4 : 2} className="border-r border-gray-300 px-3 py-2 text-center">
                      <p className="font-semibold text-gray-700 mb-1 truncate max-w-[220px]" title={unit}>{unit}</p>
                      <div className="flex gap-1 justify-center">
                        <FillBtn label="Grade" onFill={(v) => fillColumn(ui, "grade", v)} />
                        <FillBtn label="Score" onFill={(v) => fillColumn(ui, "score", v)} />
                      </div>
                    </th>
                  ))}
                </tr>
                {/* Sub-column headers */}
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500">
                  <th className="sticky left-0 z-20 bg-gray-50 border-r-2 border-gray-300 px-4 py-1.5" />
                  {units.map((_, ui) => (
                    <>
                      <th key={`${ui}-g`} className="px-2 py-1.5 font-medium text-center">Grade</th>
                      <th key={`${ui}-s`} className="px-2 py-1.5 font-medium text-center">Score</th>
                      {perLearner && <th key={`${ui}-fv`} className="px-2 py-1.5 font-medium text-center">For Verif.</th>}
                      {perLearner && <th key={`${ui}-rv`} className="px-2 py-1.5 font-medium text-center border-r border-gray-200">Verified</th>}
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={units.length * (perLearner ? 4 : 2) + 1} className="px-6 py-10 text-center text-sm text-gray-400">
                      No learners match the current filters.
                    </td>
                  </tr>
                ) : visibleRows.map((row, ri) => (
                  <tr key={row.id} className={`${ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"} ${row.withdrawn ? "opacity-60" : ""}`}>
                    <td className="sticky left-0 z-10 bg-inherit border-r-2 border-gray-200 px-4 py-1.5">
                      <p className="font-semibold text-gray-800">{row.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{row.personCode}
                        {row.withdrawn && <span className="ml-1 text-orange-500">(Withdrawn)</span>}
                      </p>
                    </td>
                    {units.map((_, ui) => {
                      const cell = row.units[ui] ?? { grade: "", score: "", forVerification: false, verified: false, released: false };
                      const isUpdated = updatedCells.has(`${row.id}-${ui}`);
                      const locked = cell.released || released;
                      return (
                        <>
                          {/* Grade */}
                          <td key={`${row.id}-${ui}-g`} className={`px-2 py-1 text-center ${isUpdated ? "bg-green-50" : ""}`}>
                            {locked ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-semibold text-gray-600">{cell.grade || "—"}</span>
                                {cell.released && <span className="w-4 h-4 rounded-full border-2 border-green-500 text-green-600 flex items-center justify-center"><Check size={9} strokeWidth={3} /></span>}
                              </div>
                            ) : (
                              <Input
                                value={cell.grade}
                                onChange={(e) => updateCell(row.id, ui, { grade: e.target.value.toUpperCase() })}
                                className="h-6 w-16 text-center text-xs px-1 mx-auto"
                                placeholder="—"
                                maxLength={12}
                              />
                            )}
                          </td>
                          {/* Score */}
                          <td key={`${row.id}-${ui}-s`} className={`px-2 py-1 text-center ${isUpdated ? "bg-green-50" : ""}`}>
                            {locked ? (
                              <span className="text-gray-500">{cell.score || "—"}</span>
                            ) : (
                              <Input
                                value={cell.score}
                                onChange={(e) => updateCell(row.id, ui, { score: e.target.value })}
                                className="h-6 w-16 text-center text-xs px-1 mx-auto"
                                placeholder="—"
                                maxLength={6}
                              />
                            )}
                          </td>
                          {/* For Verification */}
                          {perLearner && (
                            <td key={`${row.id}-${ui}-fv`} className="px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                checked={cell.forVerification}
                                disabled={locked || cell.verified}
                                onChange={(e) => updateCell(row.id, ui, { forVerification: e.target.checked })}
                                className="rounded"
                              />
                            </td>
                          )}
                          {/* Results Verified */}
                          {perLearner && (
                            <td key={`${row.id}-${ui}-rv`} className="px-2 py-1 text-center border-r border-gray-100">
                              {cell.released ? (
                                <span className="w-5 h-5 rounded-full border-2 border-green-500 text-green-600 flex items-center justify-center mx-auto">
                                  <Check size={11} strokeWidth={3} />
                                </span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={cell.verified}
                                  disabled={locked}
                                  onChange={(e) => updateCell(row.id, ui, { verified: e.target.checked })}
                                  className="rounded accent-indigo-600"
                                />
                              )}
                            </td>
                          )}
                        </>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300 inline-block" /> Updated cell
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full border-2 border-green-500 inline-flex items-center justify-center text-green-600"><Check size={9} strokeWidth={3} /></span> Released to learner (read-only)
            </span>
            <span className="flex items-center gap-1.5 text-orange-500">
              <AlertTriangle size={12} /> Withdrawn learner
            </span>
          </div>
        </div>
      )}

      {/* Release confirm modal */}
      {showReleaseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Release all verified units?</h3>
            <p className="text-sm text-gray-600 mb-2">
              Verified grades will be released and become visible to learners on the assessments screens.
            </p>
            <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded p-2 mb-4">
              Once released, grades cannot be edited — even if the Unlock records toggle is selected.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowReleaseConfirm(false)}>Cancel</Button>
              <Button className="bg-green-700 hover:bg-green-800" onClick={handleReleaseAll}>Release grades</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? "bg-teal-600" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

function FillBtn({ label, onFill }: { label: string; onFill: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  return (
    <div className="relative">
      <button
        className="text-[10px] text-teal-700 border border-teal-200 bg-teal-50 rounded px-1 py-0.5 hover:bg-teal-100"
        onClick={() => setOpen((v) => !v)}
      >
        Fill {label}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded shadow-lg p-2 min-w-[120px]">
          <p className="text-[10px] text-gray-400 mb-1">Fill column with:</p>
          <div className="flex gap-1">
            <Input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="h-6 text-xs px-1 flex-1"
              placeholder={label}
            />
            <Button size="sm" className="h-6 px-2 text-xs bg-teal-700 hover:bg-teal-800" onClick={() => { onFill(val); setOpen(false); setVal(""); }}>
              ✓
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
