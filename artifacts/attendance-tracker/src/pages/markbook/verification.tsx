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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check, CheckCircle2, SlidersHorizontal, Upload, AlertTriangle,
  LockOpen, Lock, FlaskConical, ChevronDown, ChevronUp, ChevronsUpDown,
  ArrowDownToLine, Save,
} from "lucide-react";

// ─── Reference data ────────────────────────────────────────────────────────────

const ACADEMIC_YEARS = ["2024/25", "2023/24", "2022/23"];

const SUBJECTS_LIST = [
  "Level 3 BTEC Extended Diploma",
  "GCSE English Language",
  "A Level Mathematics",
  "Access to HE Science",
];

const PROGRAMMES = [
  { name: "BTEC Diploma in Business Administration", courses: ["Online Business", "Business Planning", "Business Communication"] },
  { name: "GCSE Resit Programme", courses: ["GCSE English Language", "GCSE Mathematics"] },
  { name: "Access to HE — Science Pathway", courses: ["Access to HE Science", "Study Skills"] },
];

const UNITS_MAP: Record<string, string[]> = {
  "Level 3 BTEC Extended Diploma": ["Unit 1: Research Methods", "Unit 2: Data Analysis", "Unit 3: Workplace Practice", "Unit 4: Project Work"],
  "GCSE English Language": ["Component 1: Creative Reading", "Component 2: Writers' Viewpoints"],
  "A Level Mathematics": ["Pure 1", "Pure 2", "Statistics"],
  "Access to HE Science": ["Unit 1: Scientific Thinking", "Unit 2: Biology", "Unit 3: Chemistry"],
  "Online Business": ["Module 1: E-Commerce Basics", "Module 2: Digital Marketing"],
  "Business Planning": ["Module 1: Business Plans", "Module 2: Financial Forecasting"],
  "Business Communication": ["Module 1: Written Comms", "Module 2: Presentations"],
  "GCSE Mathematics": ["Component 1: Number", "Component 2: Algebra"],
  "Study Skills": ["Unit 1: Academic Writing"],
};

const TUTOR_GROUPS = ["All groups", "Group A", "Group B", "Group C"];

// ─── Types ─────────────────────────────────────────────────────────────────────

type UnitResult = {
  grade: string;
  score: string;
  aggregateScore: string;
  verified: boolean;
  released: boolean;
  sampled: boolean;
  generated: boolean;
};

type LearnerRow = {
  id: number;
  name: string;
  personCode: string;
  withdrawn: boolean;
  units: Record<number, UnitResult>;
};

type SortConfig = { colIdx: number; dir: "asc" | "desc" } | null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildRows(
  students: { id: number; forename: string; surname: string; personCode?: string | null }[],
  unitCount: number
): LearnerRow[] {
  const grades = ["A", "B", "Distinction", "Merit", "Pass", "C", "", "A*", "D", ""];
  return students.map((s, si) => {
    const units: Record<number, UnitResult> = {};
    for (let u = 0; u < unitCount; u++) {
      const grade = grades[(si * 2 + u) % grades.length];
      const score = grade ? String(40 + ((si * 3 + u * 7) % 55)) : "";
      const verified = grade !== "" && (si + u) % 4 === 0;
      const released = verified && (si + u) % 8 === 0;
      units[u] = {
        grade,
        score,
        aggregateScore: score ? String(Number(score) - 5) : "",
        verified,
        released,
        sampled: false,
        generated: grade !== "" && (si + u) % 3 === 0,
      };
    }
    return {
      id: s.id,
      name: `${s.surname}, ${s.forename}`,
      personCode: s.personCode ?? `PC${String(s.id).padStart(4, "0")}`,
      withdrawn: si % 7 === 0,
      units,
    };
  });
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function MarkbookVerification() {
  const { data: students = [] } = useListStudents();

  // ── Search filters ──────────────────────────────────────────────────────────
  const [searchMode, setSearchMode] = useState<"subject" | "programme">("subject");
  const [academicYear, setAcademicYear] = useState("2024/25");
  const [subject, setSubject] = useState("none");
  const [selectedProgramme, setSelectedProgramme] = useState("none");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [tutorGroup, setTutorGroup] = useState("All groups");
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [onlyGenerated, setOnlyGenerated] = useState(false);
  const [excludeWithdrawn, setExcludeWithdrawn] = useState(false);

  // ── Grid state ──────────────────────────────────────────────────────────────
  const [gridVisible, setGridVisible] = useState(false);
  const [rows, setRows] = useState<LearnerRow[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [updatedCells, setUpdatedCells] = useState<Set<string>>(new Set());
  const [savedCells, setSavedCells] = useState<Set<string>>(new Set());

  // ── Toolbar toggles ─────────────────────────────────────────────────────────
  const [unlockRecords, setUnlockRecords] = useState(false);
  const [recordSampled, setRecordSampled] = useState(false);
  const [showScore, setShowScore] = useState(true);
  const [showAggScore, setShowAggScore] = useState(false);

  // ── Sort & filter ───────────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [colFilters, setColFilters] = useState<Record<number, string>>({});

  // ── Dialogs ─────────────────────────────────────────────────────────────────
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [showFillAll, setShowFillAll] = useState<{ uid: number; field: "grade" | "score" } | null>(null);
  const [fillAllVal, setFillAllVal] = useState("");

  // ── Derived ─────────────────────────────────────────────────────────────────
  const allReleased = gridVisible && rows.length > 0 && units.every((_, ui) =>
    rows.every((r) => r.units[ui]?.released)
  );

  const programmeCourses = selectedProgramme !== "none"
    ? (PROGRAMMES.find((p) => p.name === selectedProgramme)?.courses ?? [])
    : [];

  // ── Actions ─────────────────────────────────────────────────────────────────
  const doSearch = () => {
    let derivedUnits: string[] = [];
    if (searchMode === "subject" && subject !== "none") {
      derivedUnits = UNITS_MAP[subject] ?? [];
    } else if (searchMode === "programme" && selectedCourses.length > 0) {
      derivedUnits = selectedCourses.flatMap((c) => (UNITS_MAP[c] ?? []).map((u) => `${c} — ${u}`));
    }
    if (!derivedUnits.length) return;
    setUnits(derivedUnits);
    setRows(buildRows(students, derivedUnits.length));
    setUpdatedCells(new Set());
    setSavedCells(new Set());
    setGridVisible(true);
    setSortConfig(null);
    setColFilters({});
  };

  const clearFilters = () => {
    setGridVisible(false);
    setSubject("none");
    setSelectedProgramme("none");
    setSelectedCourses([]);
    setOnlyUnverified(false);
    setOnlyGenerated(false);
    setExcludeWithdrawn(false);
    setUnlockRecords(false);
    setRecordSampled(false);
  };

  const updateCell = (lid: number, uid: number, patch: Partial<UnitResult>) => {
    setRows((prev) => prev.map((r) =>
      r.id === lid ? { ...r, units: { ...r.units, [uid]: { ...r.units[uid], ...patch } } } : r
    ));
    setUpdatedCells((prev) => new Set(prev).add(`${lid}-${uid}`));
  };

  const doFillAll = () => {
    if (!showFillAll || !fillAllVal) return;
    const { uid, field } = showFillAll;
    setRows((prev) => prev.map((r) => {
      if (r.units[uid]?.released) return r;
      if (recordSampled && r.units[uid]?.sampled) return r;
      setUpdatedCells((p) => new Set(p).add(`${r.id}-${uid}`));
      return { ...r, units: { ...r.units, [uid]: { ...r.units[uid], [field]: fillAllVal } } };
    }));
    setShowFillAll(null);
    setFillAllVal("");
  };

  const saveAll = () => {
    setSavedCells(new Set(updatedCells));
    setUpdatedCells(new Set());
  };

  const verifyAllGraded = () => {
    setRows((prev) => prev.map((r) => {
      const next = { ...r.units };
      Object.keys(next).forEach((k) => {
        const u = next[Number(k)];
        if (u.grade && !u.released && (unlockRecords || !u.verified)) {
          next[Number(k)] = { ...u, verified: true };
          setUpdatedCells((p) => new Set(p).add(`${r.id}-${k}`));
        }
      });
      return { ...r, units: next };
    }));
  };

  const handleReleaseAll = () => {
    setRows((prev) => prev.map((r) => {
      const next = { ...r.units };
      Object.keys(next).forEach((k) => {
        if (next[Number(k)].verified) next[Number(k)] = { ...next[Number(k)], released: true };
      });
      return { ...r, units: next };
    }));
    setShowReleaseConfirm(false);
  };

  const toggleSort = (colIdx: number) => {
    setSortConfig((prev) => {
      if (prev?.colIdx === colIdx) return prev.dir === "asc" ? { colIdx, dir: "desc" } : null;
      return { colIdx, dir: "asc" };
    });
  };

  const toggleCourse = (c: string) => {
    setSelectedCourses((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  // ── Filtered & sorted rows ─────────────────────────────────────────────────
  const displayRows = useMemo(() => {
    let r = rows.filter((row) => {
      if (excludeWithdrawn && row.withdrawn) return false;
      if (onlyUnverified && units.every((_, ui) => row.units[ui]?.verified)) return false;
      if (onlyGenerated && !units.some((_, ui) => row.units[ui]?.generated)) return false;
      // column grade filters
      for (const [k, fv] of Object.entries(colFilters)) {
        if (!fv) continue;
        const cell = row.units[Number(k)];
        if (!cell?.grade.toLowerCase().includes(fv.toLowerCase())) return false;
      }
      return true;
    });
    if (sortConfig) {
      r = [...r].sort((a, b) => {
        const ag = a.units[sortConfig.colIdx]?.grade ?? "";
        const bg = b.units[sortConfig.colIdx]?.grade ?? "";
        return sortConfig.dir === "asc" ? ag.localeCompare(bg) : bg.localeCompare(ag);
      });
    }
    return r;
  }, [rows, excludeWithdrawn, onlyUnverified, onlyGenerated, colFilters, sortConfig, units]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0 -mx-6 -mt-6 min-h-screen bg-slate-50">

      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-xl font-bold text-gray-900">Markbook Verification</h1>
          <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded font-medium">
            New
          </span>
          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded font-medium">
            Role: Exams Synchronisation
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Verify and release assessment grades. Replaces the old Markbook Verification screen.
          Supports search by subject or programme, unlock records, sampled units, and grade release.
        </p>
      </div>

      {/* Filter panel */}
      {!gridVisible && (
        <div className="px-6 py-5 border-b border-gray-200 bg-white">
          <div className="max-w-2xl space-y-5">

            {/* Search mode toggle */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Search by</p>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {(["subject", "programme"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSearchMode(m)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                      searchMode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Academic Year */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <Select value={academicYear} onValueChange={setAcademicYear}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Subject or Programme */}
              {searchMode === "subject" ? (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select subject…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select subject —</SelectItem>
                      {SUBJECTS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Programme <span className="text-red-500">*</span>
                  </label>
                  <Select value={selectedProgramme} onValueChange={(v) => { setSelectedProgramme(v); setSelectedCourses([]); }}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select programme…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select programme —</SelectItem>
                      {PROGRAMMES.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tutor Group */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Tutor Group</label>
                <Select value={tutorGroup} onValueChange={setTutorGroup}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{TUTOR_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Course multi-select for programme mode */}
            {searchMode === "programme" && programmeCourses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1.5">
                  Select courses <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">(select multiple)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {programmeCourses.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleCourse(c)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                        selectedCourses.includes(c)
                          ? "bg-teal-700 text-white border-teal-700"
                          : "bg-white text-gray-600 border-gray-300 hover:border-teal-400"
                      }`}
                    >
                      {selectedCourses.includes(c) && <Check size={10} className="inline mr-1" />}
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter toggles */}
            <div className="space-y-2.5">
              <Toggle label="Only show learners with unverified grades" checked={onlyUnverified} onChange={setOnlyUnverified} />
              <Toggle label="Only show learners with generated grades" checked={onlyGenerated} onChange={setOnlyGenerated} />
              <Toggle label="Exclude withdrawn learners" checked={excludeWithdrawn} onChange={setExcludeWithdrawn} />
            </div>

            <Button
              className="bg-teal-700 hover:bg-teal-800 gap-2"
              onClick={doSearch}
              disabled={searchMode === "subject" ? subject === "none" : selectedCourses.length === 0}
            >
              <SlidersHorizontal size={14} /> Search
            </Button>
          </div>
        </div>
      )}

      {/* Grid view */}
      {gridVisible && (
        <div>
          {/* Active filter bar */}
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs flex-wrap gap-y-1">
            <div className="flex items-center gap-3 text-gray-600">
              <span className="font-semibold text-amber-800">{academicYear}</span>
              <span className="text-gray-400">·</span>
              <span>{searchMode === "subject" ? subject : selectedProgramme}</span>
              {searchMode === "programme" && selectedCourses.length > 0 && (
                <span className="text-gray-500">({selectedCourses.length} course{selectedCourses.length !== 1 ? "s" : ""})</span>
              )}
              {tutorGroup !== "All groups" && <><span className="text-gray-400">·</span><span>{tutorGroup}</span></>}
              {onlyUnverified && <span className="text-amber-700 font-medium">· Unverified only</span>}
              {onlyGenerated && <span className="text-amber-700 font-medium">· Generated only</span>}
              {excludeWithdrawn && <span className="text-amber-700 font-medium">· Withdrawn excluded</span>}
            </div>
            <button className="text-teal-700 hover:text-teal-900 font-semibold underline" onClick={clearFilters}>
              Clear all filters
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-6 py-2.5 bg-white border-b border-gray-200 flex items-center gap-2 flex-wrap">
            {/* Left: toggles */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Unlock records */}
              <ToolbarToggle
                icon={unlockRecords ? <LockOpen size={13} /> : <Lock size={13} />}
                label="Unlock records"
                checked={unlockRecords}
                onChange={setUnlockRecords}
                color="text-orange-600"
                title="Requires 'Clear verified status' role"
              />
              {/* Record sampled units */}
              <ToolbarToggle
                icon={<FlaskConical size={13} />}
                label="Record sampled units"
                checked={recordSampled}
                onChange={setRecordSampled}
                color="text-purple-600"
              />
              {/* Display settings */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">
                    Display <ChevronDown size={11} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="text-xs w-52">
                  <DropdownMenuItem onClick={() => setShowScore((v) => !v)} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-sm border ${showScore ? "bg-teal-600 border-teal-600" : "border-gray-300"}`} />
                    Unit score
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAggScore((v) => !v)} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-sm border ${showAggScore ? "bg-teal-600 border-teal-600" : "border-gray-300"}`} />
                    Aggregate unit score
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right: action buttons */}
            <div className="ml-auto flex items-center gap-2">
              {/* Fill column (all records) */}
              {!recordSampled && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                      <ArrowDownToLine size={12} /> Fill column <ChevronDown size={11} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs">
                    {units.map((u, ui) => (
                      <DropdownMenuItem key={ui} onClick={() => { setShowFillAll({ uid: ui, field: "grade" }); setFillAllVal(""); }}>
                        {u.length > 40 ? u.slice(0, 40) + "…" : u}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* Verify all graded */}
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={verifyAllGraded}>
                <Check size={12} /> Verify all graded
              </Button>
              {/* Save all */}
              {!recordSampled && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={saveAll} disabled={updatedCells.size === 0}>
                  <Save size={12} /> Save all
                </Button>
              )}
              {/* Release all verified */}
              {!allReleased && (
                <Button size="sm" className="gap-1.5 text-xs h-7 bg-green-700 hover:bg-green-800" onClick={() => setShowReleaseConfirm(true)}>
                  <Upload size={12} /> Release all verified units
                </Button>
              )}
              {allReleased && (
                <span className="flex items-center gap-1 text-xs text-green-700 font-medium bg-green-50 border border-green-200 rounded px-2 py-1">
                  <CheckCircle2 size={13} /> Released
                </span>
              )}
            </div>
          </div>

          {/* Unlock warning */}
          {unlockRecords && (
            <div className="px-6 py-1.5 bg-orange-50 border-b border-orange-200 text-xs text-orange-700 flex items-center gap-2">
              <LockOpen size={12} /> Records unlocked — verification status can be changed. Cannot be changed if grades have been released.
            </div>
          )}

          {/* Sampled mode info */}
          {recordSampled && (
            <div className="px-6 py-1.5 bg-purple-50 border-b border-purple-200 text-xs text-purple-700 flex items-center gap-2">
              <FlaskConical size={12} /> Sampled units mode — Verified column is read-only. Fill column and Save all are disabled for sampled units.
            </div>
          )}

          {/* Released info */}
          {allReleased && (
            <div className="px-6 py-1.5 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 flex items-center gap-2">
              <CheckCircle2 size={12} /> All verified grades have been released to learners and cannot be edited.
            </div>
          )}

          {/* Grid */}
          <div className="overflow-auto">
            <table className="border-collapse min-w-full text-xs">
              <thead>
                {/* Unit span headers */}
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="sticky left-0 z-20 bg-gray-100 border-r-2 border-gray-300 px-4 py-2.5 text-left font-bold text-gray-700 min-w-[190px]" rowSpan={2}>
                    Learner
                  </th>
                  {units.map((unit, ui) => {
                    const colCount = 1 + (showScore ? 1 : 0) + (showAggScore ? 1 : 0) + 1; // grade + score + agg + sampled/verified
                    return (
                      <th
                        key={ui}
                        colSpan={colCount}
                        className="border-r border-gray-300 px-3 py-2 text-center"
                      >
                        <div className="font-semibold text-gray-700 text-xs truncate max-w-[240px] mb-1" title={unit}>{unit}</div>
                        {!recordSampled && (
                          <button
                            className="flex items-center gap-0.5 text-[10px] text-teal-700 border border-teal-200 bg-teal-50 rounded px-1.5 py-0.5 mx-auto hover:bg-teal-100"
                            onClick={() => { setShowFillAll({ uid: ui, field: "grade" }); setFillAllVal(""); }}
                          >
                            <ArrowDownToLine size={9} /> Fill column (all records)
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
                {/* Sub-column labels */}
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500">
                  {units.map((_, ui) => (
                    <>
                      <th key={`${ui}-g`} className="px-2 py-1.5 text-center font-medium min-w-[72px]">
                        <div className="flex items-center justify-center gap-0.5">
                          Grade
                          <button onClick={() => toggleSort(ui)} className="text-gray-400 hover:text-gray-700 ml-0.5">
                            {sortConfig?.colIdx === ui
                              ? sortConfig.dir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                              : <ChevronsUpDown size={10} />
                            }
                          </button>
                        </div>
                        {/* Column grade filter */}
                        <Input
                          value={colFilters[ui] ?? ""}
                          onChange={(e) => setColFilters((prev) => ({ ...prev, [ui]: e.target.value }))}
                          className="h-5 text-[10px] px-1 mt-0.5 w-14 mx-auto"
                          placeholder="Filter…"
                        />
                      </th>
                      {showScore && (
                        <th key={`${ui}-s`} className="px-2 py-1.5 text-center font-medium min-w-[60px]">Score</th>
                      )}
                      {showAggScore && (
                        <th key={`${ui}-agg`} className="px-2 py-1.5 text-center font-medium min-w-[60px]">Agg. Score</th>
                      )}
                      <th
                        key={`${ui}-v`}
                        className="px-2 py-1.5 text-center font-medium min-w-[60px] border-r border-gray-200"
                      >
                        {recordSampled ? "Sampled" : "Verified"}
                      </th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={units.length * (1 + (showScore ? 1 : 0) + (showAggScore ? 1 : 0) + 1) + 1} className="px-6 py-12 text-center text-sm text-gray-400">
                      No learners match the current filters.
                    </td>
                  </tr>
                ) : displayRows.map((row, ri) => (
                  <tr key={row.id} className={`${ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"} ${row.withdrawn ? "opacity-60" : ""}`}>
                    {/* Learner name (sticky) */}
                    <td className="sticky left-0 z-10 bg-inherit border-r-2 border-gray-200 px-4 py-1.5">
                      <p className="font-semibold text-gray-800 text-xs">{row.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        {row.personCode}
                        {row.withdrawn && <span className="ml-1 text-orange-500">(Withdrawn)</span>}
                      </p>
                    </td>
                    {units.map((_, ui) => {
                      const cell = row.units[ui] ?? { grade: "", score: "", aggregateScore: "", verified: false, released: false, sampled: false, generated: false };
                      const isUpdated = updatedCells.has(`${row.id}-${ui}`);
                      const locked = cell.released || (cell.verified && !unlockRecords);
                      return (
                        <>
                          {/* Grade */}
                          <td key={`${row.id}-${ui}-g`} className={`px-2 py-1 text-center ${isUpdated ? "bg-green-50" : ""}`}>
                            {locked ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-semibold text-gray-600 text-xs">{cell.grade || "—"}</span>
                                {cell.released ? (
                                  <span className="w-4 h-4 rounded-full border-2 border-green-500 text-green-600 flex items-center justify-center">
                                    <Check size={9} strokeWidth={3} />
                                  </span>
                                ) : (
                                  <span className="w-4 h-4 rounded-full border-2 border-indigo-400 text-indigo-600 flex items-center justify-center">
                                    <Check size={9} strokeWidth={3} />
                                  </span>
                                )}
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
                          {showScore && (
                            <td key={`${row.id}-${ui}-s`} className={`px-2 py-1 text-center ${isUpdated ? "bg-green-50" : ""}`}>
                              {locked ? (
                                <span className="text-gray-500 text-xs">{cell.score || "—"}</span>
                              ) : (
                                <Input
                                  value={cell.score}
                                  onChange={(e) => updateCell(row.id, ui, { score: e.target.value })}
                                  className="h-6 w-14 text-center text-xs px-1 mx-auto"
                                  placeholder="—"
                                  maxLength={6}
                                />
                              )}
                            </td>
                          )}
                          {/* Aggregate score */}
                          {showAggScore && (
                            <td key={`${row.id}-${ui}-agg`} className="px-2 py-1 text-center text-gray-500 text-xs">
                              {cell.aggregateScore || "—"}
                            </td>
                          )}
                          {/* Sampled or Verified */}
                          <td key={`${row.id}-${ui}-v`} className="px-2 py-1 text-center border-r border-gray-100">
                            {recordSampled ? (
                              <input
                                type="checkbox"
                                checked={cell.sampled}
                                onChange={(e) => updateCell(row.id, ui, { sampled: e.target.checked })}
                                className="rounded accent-purple-600"
                              />
                            ) : cell.released ? (
                              <span className="w-5 h-5 rounded-full border-2 border-green-500 text-green-600 flex items-center justify-center mx-auto">
                                <Check size={10} strokeWidth={3} />
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={cell.verified}
                                disabled={cell.released}
                                onChange={(e) => updateCell(row.id, ui, { verified: e.target.checked })}
                                className="rounded accent-indigo-600"
                              />
                            )}
                          </td>
                        </>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 border-t border-gray-100 bg-white flex items-center gap-6 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300 inline-block" /> Updated cell
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full border-2 border-indigo-400 inline-flex items-center justify-center text-indigo-600"><Check size={9} strokeWidth={3} /></span> Verified
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

      {/* Fill column dialog */}
      <Dialog open={!!showFillAll} onOpenChange={() => setShowFillAll(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Fill column (all records)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Fill all editable cells in <strong>{showFillAll !== null ? (units[showFillAll.uid]?.length > 50 ? units[showFillAll.uid].slice(0, 50) + "…" : units[showFillAll.uid]) : ""}</strong> with:
          </p>
          <Input
            value={fillAllVal}
            onChange={(e) => setFillAllVal(e.target.value.toUpperCase())}
            placeholder="Enter grade value…"
            className="text-sm"
            onKeyDown={(e) => e.key === "Enter" && doFillAll()}
            autoFocus
          />
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Released cells and (in sampled mode) sampled unit cells will not be overwritten.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFillAll(null)}>Cancel</Button>
            <Button onClick={doFillAll} disabled={!fillAllVal.trim()} className="bg-teal-700 hover:bg-teal-800">
              Fill column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release confirm dialog */}
      <Dialog open={showReleaseConfirm} onOpenChange={setShowReleaseConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Release all verified units?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 mb-2">
            Verified grades will become visible to learners on the assessments screens.
          </p>
          <p className="text-xs text-red-700 font-medium bg-red-50 border border-red-200 rounded p-2">
            Once released, grades cannot be edited — even if Unlock records is selected.
            Released grades are shown with a green circle around the verified tick.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReleaseConfirm(false)}>Cancel</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={handleReleaseAll}>Release grades</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function ToolbarToggle({
  icon, label, checked, onChange, color = "text-gray-600", title,
}: {
  icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void; color?: string; title?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      title={title}
      className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors font-medium ${
        checked
          ? `${color} border-current bg-current/10`
          : "text-gray-500 border-gray-200 hover:bg-gray-50"
      }`}
    >
      <span className={checked ? color : "text-gray-400"}>{icon}</span>
      {label}
    </button>
  );
}
