import { useState, useRef } from "react";
import { useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, ChevronDown, SlidersHorizontal, AlertCircle, ArrowDownToLine } from "lucide-react";

// ─── Static reference data ────────────────────────────────────────────────────

const ACADEMIC_YEARS = ["2024/25", "2023/24", "2022/23"];
const SUBJECTS = ["Level 3 BTEC Extended Diploma", "GCSE English Language", "A Level Mathematics", "Access to HE Science"];
const UNITS: Record<string, string[]> = {
  "Level 3 BTEC Extended Diploma": ["Unit 1: Research Methods", "Unit 2: Data Analysis", "Unit 3: Workplace Practice", "Unit 4: Project Work", "Unit 5: Professional Development"],
  "GCSE English Language": ["Component 1: Explorations in Creative Reading", "Component 2: Writers' Viewpoints", "Component 3: Spoken Language"],
  "A Level Mathematics": ["Pure 1", "Pure 2", "Statistics", "Mechanics"],
  "Access to HE Science": ["Unit 1: Scientific Thinking", "Unit 2: Biology", "Unit 3: Chemistry", "Unit 4: Lab Skills"],
};
const TUTOR_GROUPS = ["All groups", "Group A", "Group B", "Group C"];
const GRADES = ["", "A*", "A", "B", "C", "D", "E", "U", "Pass", "Merit", "Distinction", "N/A"];

type CellState = { grade: string; verified: boolean; released: boolean };
type MarksMap = Record<number, Record<number, CellState>>;

function initMarks(studentIds: number[], unitCount: number): MarksMap {
  const m: MarksMap = {};
  const sampleGrades = ["A", "B", "Merit", "Pass", "C", "Distinction", "", "", "A*", "B"];
  studentIds.forEach((sid, si) => {
    m[sid] = {};
    for (let u = 0; u < unitCount; u++) {
      const grade = sampleGrades[(si + u) % sampleGrades.length];
      const verified = grade !== "" && (si + u) % 3 === 0;
      const released = verified && (si + u) % 6 === 0;
      m[sid][u] = { grade, verified, released };
    }
  });
  return m;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Markbook() {
  const { data: students = [] } = useListStudents();

  const [academicYear, setAcademicYear] = useState("2024/25");
  const [subject, setSubject] = useState("none");
  const [tutorGroup, setTutorGroup] = useState("All groups");
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);

  const [gridVisible, setGridVisible] = useState(false);
  const [marks, setMarks] = useState<MarksMap>({});
  const [updatedCells, setUpdatedCells] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(100);

  const units = subject !== "none" ? (UNITS[subject] ?? []) : [];

  const doSearch = () => {
    if (!subject || subject === "none") return;
    const ids = students.map((s) => s.id);
    setMarks(initMarks(ids, units.length));
    setUpdatedCells(new Set());
    setGridVisible(true);
  };

  const clearFilters = () => {
    setGridVisible(false);
    setSubject("none");
    setTutorGroup("All groups");
    setOnlyUnverified(false);
    setOnlyUnmarked(false);
  };

  const setGrade = (sid: number, uid: number, grade: string) => {
    setMarks((prev) => ({
      ...prev,
      [sid]: { ...prev[sid], [uid]: { ...prev[sid]?.[uid], grade } },
    }));
    setUpdatedCells((prev) => new Set(prev).add(`${sid}-${uid}`));
  };

  const fillColumn = (uid: number, grade: string) => {
    if (!grade) return;
    setMarks((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        if (!next[s.id]?.[uid]?.released) {
          next[s.id] = { ...next[s.id], [uid]: { ...next[s.id]?.[uid], grade } };
          setUpdatedCells((p) => new Set(p).add(`${s.id}-${uid}`));
        }
      });
      return next;
    });
  };

  const visibleStudents = students.filter((s) => {
    if (onlyUnverified) {
      const hasUnverified = units.some((_, ui) => !marks[s.id]?.[ui]?.verified);
      if (!hasUnverified) return false;
    }
    if (onlyUnmarked) {
      const hasUnmarked = units.some((_, ui) => !marks[s.id]?.[ui]?.grade);
      if (!hasUnmarked) return false;
    }
    return true;
  });

  return (
    <div className="space-y-0 -mx-6 -mt-6">
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-gray-900">Markbook</h1>
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded font-medium">
              Licence: EBS4Markbook
            </span>
          </div>
          <p className="text-sm text-gray-500">Mark assessment results for programme units you are associated with.</p>
        </div>
        {gridVisible && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 flex items-center gap-1"><AlertCircle size={12} /> Markbook grids can be large — adjust browser zoom if needed</span>
            <div className="flex items-center gap-1 border border-gray-200 rounded px-2 py-1">
              <button className="text-xs text-gray-500 hover:text-gray-800 px-1" onClick={() => setZoom((z) => Math.max(60, z - 10))}>−</button>
              <span className="text-xs text-gray-600 w-10 text-center">{zoom}%</span>
              <button className="text-xs text-gray-500 hover:text-gray-800 px-1" onClick={() => setZoom((z) => Math.min(150, z + 10))}>+</button>
            </div>
          </div>
        )}
      </div>

      {/* Filter panel (shown when grid is NOT visible) */}
      {!gridVisible && (
        <div className="px-6 py-5 bg-slate-50 border-b border-gray-200">
          <div className="max-w-3xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Academic Year <span className="text-red-500">*</span></label>
                <Select value={academicYear} onValueChange={setAcademicYear}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Subject / Programme <span className="text-red-500">*</span></label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select subject…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select subject —</SelectItem>
                    {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Tutor Group</label>
                <Select value={tutorGroup} onValueChange={setTutorGroup}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{TUTOR_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <Toggle label="Only show learners without verified grades" checked={onlyUnverified} onChange={setOnlyUnverified} />
              <Toggle label="Only show learners with unmarked assessments" checked={onlyUnmarked} onChange={setOnlyUnmarked} />
            </div>

            <Button
              className="bg-teal-700 hover:bg-teal-800 gap-2"
              onClick={doSearch}
              disabled={subject === "none"}
            >
              <SlidersHorizontal size={14} /> Search
            </Button>
          </div>
        </div>
      )}

      {/* Grid view */}
      {gridVisible && (
        <div>
          {/* Active filter summary bar */}
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 text-gray-600">
              <span className="font-semibold text-amber-800">{academicYear}</span>
              <span className="text-gray-400">·</span>
              <span>{subject}</span>
              {tutorGroup !== "All groups" && <><span className="text-gray-400">·</span><span>{tutorGroup}</span></>}
              {onlyUnverified && <span className="text-amber-700 font-medium">· Unverified only</span>}
              {onlyUnmarked && <span className="text-amber-700 font-medium">· Unmarked only</span>}
            </div>
            <button className="text-teal-700 hover:text-teal-900 font-semibold underline" onClick={clearFilters}>
              Clear all filters
            </button>
          </div>

          {/* Scrollable markbook grid */}
          <div className="overflow-auto" style={{ fontSize: `${zoom}%` }}>
            <table className="border-collapse min-w-full">
              <thead>
                {/* Unit name row */}
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="sticky left-0 z-20 bg-gray-100 border-r-2 border-gray-300 px-4 py-2.5 text-left text-xs font-bold text-gray-700 min-w-[180px]">
                    Learner
                  </th>
                  {units.map((unit, ui) => (
                    <th key={ui} className="border-r border-gray-200 px-3 py-2 min-w-[140px]">
                      <div className="text-left">
                        <p className="text-xs font-semibold text-gray-700 mb-1 truncate max-w-[130px]" title={unit}>{unit}</p>
                        <FillColumnButton onFill={(grade) => fillColumn(ui, grade)} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleStudents.length === 0 ? (
                  <tr>
                    <td colSpan={units.length + 1} className="px-6 py-10 text-center text-sm text-gray-400">
                      No learners match the current filters.
                    </td>
                  </tr>
                ) : visibleStudents.map((s, si) => (
                  <tr key={s.id} className={si % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="sticky left-0 z-10 bg-inherit border-r-2 border-gray-200 px-4 py-1.5">
                      <p className="text-xs font-semibold text-gray-800">{s.surname}, {s.forename}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{s.personCode}</p>
                    </td>
                    {units.map((_, ui) => {
                      const cell = marks[s.id]?.[ui] ?? { grade: "", verified: false, released: false };
                      const isUpdated = updatedCells.has(`${s.id}-${ui}`);
                      return (
                        <td key={ui} className={`border-r border-gray-100 px-2 py-1 text-center ${isUpdated && !cell.verified ? "bg-green-50" : ""}`}>
                          <GradeCell
                            grade={cell.grade}
                            verified={cell.verified}
                            released={cell.released}
                            onChange={(g) => setGrade(s.id, ui, g)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><VerifiedBadge released={false} /> Verified grade</span>
            <span className="flex items-center gap-1.5"><VerifiedBadge released={true} /> Released to learner (read-only)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300 inline-block" /> Updated cell</span>
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

function VerifiedBadge({ released }: { released: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border-2 ${released ? "border-green-500 text-green-600 bg-green-50" : "border-indigo-400 text-indigo-600 bg-indigo-50"}`}>
      <Check size={11} strokeWidth={3} />
    </span>
  );
}

function GradeCell({
  grade, verified, released, onChange,
}: { grade: string; verified: boolean; released: boolean; onChange: (g: string) => void }) {
  if (released) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-xs font-semibold text-gray-600">{grade || "—"}</span>
        <VerifiedBadge released />
      </div>
    );
  }
  if (verified) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-xs font-semibold text-gray-700">{grade || "—"}</span>
        <VerifiedBadge released={false} />
      </div>
    );
  }
  return (
    <input
      type="text"
      value={grade}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className="w-16 text-center text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200 bg-white"
      placeholder="—"
      maxLength={12}
    />
  );
}

function FillColumnButton({ onFill }: { onFill: (grade: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const QUICK = ["A*", "A", "B", "C", "D", "U", "Pass", "Merit", "Distinction"];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        className="flex items-center gap-0.5 text-[10px] text-teal-700 hover:text-teal-900 font-medium border border-teal-200 bg-teal-50 rounded px-1.5 py-0.5"
        onClick={() => setOpen((v) => !v)}
        title="Fill column (all records)"
      >
        <ArrowDownToLine size={10} /> Fill column
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[90px]">
          <p className="text-[10px] text-gray-400 px-2 pb-1 border-b border-gray-100">Fill all with:</p>
          {QUICK.map((g) => (
            <button
              key={g}
              className="w-full text-left px-3 py-1 text-xs hover:bg-teal-50 text-gray-700"
              onClick={() => { onFill(g); setOpen(false); }}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
