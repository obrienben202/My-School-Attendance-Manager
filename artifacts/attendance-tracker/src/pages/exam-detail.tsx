import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useListCourses, useListStudents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronsUpDown } from "lucide-react";
import { getPagination } from "@/lib/pagination";

const EXAM_NAMES = [
  "Functional Skills English Level 1 - Reading",
  "Functional Skills English Level 1 - Writing",
  "Functional Skills English Level 2 - Reading",
  "Functional Skills Maths Level 1",
  "Functional Skills Maths Level 2",
  "BTEC Business Unit Assessment",
  "A Level Business Studies Paper 1",
  "A Level Mathematics Paper 2",
];

const BOARD_OCCURRENCES = ["23JAN17AM", "24JAN17PM", "24JAN17AM", "25JAN17PM"];
const EXAM_DATES = ["23/01/2025", "24/01/2025", "24/01/2025", "25/01/2025"];
const START_TIMES = ["09:00", "10:00", "13:00", "13:30", "14:00"];
const FINISH_TIMES = ["10:00", "11:00", "14:00", "14:30", "15:00"];

function InfoCell({ label, value, link = false }: { label: string; value?: string | number | null; link?: boolean }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-bold text-slate-700 mb-0.5">{label}</p>
      {link ? (
        <p className="text-sm text-sky-700 hover:underline cursor-pointer">{value ?? "—"}</p>
      ) : (
        <p className="text-sm text-slate-900">{value ?? "—"}</p>
      )}
    </div>
  );
}

export default function ExamDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: courses, isLoading: isCoursesLoading } = useListCourses();
  const { data: students, isLoading: isStudentsLoading } = useListStudents();

  const course = courses?.find((c) => c.id === id);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;
  const entries = students?.slice(0, (id % 6) + 1) ?? [];
  const normalizedFilter = filter.trim().toLowerCase();
  const filteredEntries = normalizedFilter
    ? entries.filter(student =>
        `${8000 + student.id} ${student.surname} ${student.forename}`.toLowerCase().includes(normalizedFilter)
      )
    : entries;
  const pagination = getPagination(filteredEntries.length, page, PAGE_SIZE);
  const { totalPages, currentPage } = pagination;
  const pageEntries = filteredEntries.slice(pagination.startIndex, pagination.endIndex);

  useEffect(() => {
    setPage(currentPage);
  }, [currentPage]);

  if (isCoursesLoading || isStudentsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!course) {
    return <div className="p-12 text-center text-muted-foreground">Exam not found.</div>;
  }

  const examIdx = (id - 1) % EXAM_NAMES.length;
  const examName = EXAM_NAMES[examIdx];
  const examCode = `${id * 374801}-${String(id).padStart(3, "0")}`;
  const boardOccurrence = BOARD_OCCURRENCES[id % BOARD_OCCURRENCES.length];
  const examDate = EXAM_DATES[id % EXAM_DATES.length];
  const startTime = START_TIMES[id % START_TIMES.length];
  const finishTime = FINISH_TIMES[id % FINISH_TIMES.length];
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-800">Exam Details</h1>

      {/* Main details card */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-800">
            Details for Exam: {examName} ({examCode})
          </p>
        </div>

        <div className="px-5 py-4">
          {/* 3-column grid */}
          <div className="grid grid-cols-3 gap-x-8 border-b border-slate-100 pb-3 mb-3">
            <InfoCell label="Exam Code" value={examCode} />
            <InfoCell label="Exam Name" value={examName} />
            <InfoCell label="Board Name" value="CITY AND GUILDS" />
          </div>
          <div className="grid grid-cols-3 gap-x-8 border-b border-slate-100 pb-3 mb-3">
            <InfoCell label="Board Code" value="CG" />
            <InfoCell label="Board Type" value="CG" />
            <InfoCell label="Exam Date" value={examDate} />
          </div>
          <div className="grid grid-cols-3 gap-x-8 border-b border-slate-100 pb-3 mb-3">
            <InfoCell label="Start Time" value={startTime} />
            <InfoCell label="Finish Time" value={finishTime} />
            <InfoCell label="Board Occurrence" value={boardOccurrence} />
          </div>
          <div className="grid grid-cols-3 gap-x-8 border-b border-slate-100 pb-3 mb-3">
            <InfoCell label="Eo Exam Name" value={examName} />
            <InfoCell label="Exam Level" value="Level 2" />
            <InfoCell label="Exam Method" value="—" />
          </div>
          <div className="grid grid-cols-3 gap-x-8">
            <InfoCell label="Submission Level" value="CG/COMPONT" />
            <InfoCell label="Entries" value={entries.length} />
            <InfoCell label="Exam Occurrence Id" value={240 + id} />
          </div>
        </div>
      </div>

      {/* Exam Entries */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-700 text-sm">Exam Entries</p>
        </div>
        <div className="px-4 py-3">
          <div className="flex justify-end mb-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Filter:</span>
              <input
                value={filter}
                onChange={event => { setFilter(event.target.value); setPage(0); }}
                aria-label="Filter exam entries"
                className="border border-slate-300 rounded px-2 py-0.5 text-xs w-40 outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {["Person Code", "Candidate", "Candidate Ref", "Entry Date", "Confirmed", "First Grade", "Course Occurrence", "Progress Status"].map(col => (
                  <th key={col} className="text-left text-xs font-semibold text-slate-600 pb-2 pr-4">
                    <span className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900">
                      {col} <ChevronsUpDown className="w-3 h-3 opacity-50" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 text-sm">
                    {entries.length === 0 ? "No entries for this exam." : "No exam entries match your filter."}
                  </td>
                </tr>
              ) : (
                pageEntries.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2 pr-4 text-slate-600">{8000 + s.id}</td>
                    <td className="py-2 pr-4 text-sky-700 hover:underline cursor-pointer">
                      {s.surname}, {s.forename}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">—</td>
                    <td className="py-2 pr-4 text-slate-600">{examDate}</td>
                    <td className="py-2 pr-4 text-slate-600">Y</td>
                    <td className="py-2 pr-4 text-slate-600">—</td>
                    <td className="py-2 pr-4 text-sky-700 hover:underline cursor-pointer">
                      {course.code} ({boardOccurrence.slice(-4)})
                    </td>
                    <td className="py-2 pr-4 text-slate-600">Active</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-500">
              Showing {filteredEntries.length === 0 ? 0 : pagination.startIndex + 1} to {pagination.endIndex} of {filteredEntries.length} entries
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous exam entries page"
                  onClick={() => setPage(value => Math.max(0, value - 1))}
                  disabled={!pagination.canGoPrevious}
                  className="w-7 h-7 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="px-1 text-xs text-slate-500">{currentPage + 1} / {totalPages}</span>
                <button
                  type="button"
                  aria-label="Next exam entries page"
                  onClick={() => setPage(value => Math.min(totalPages - 1, value + 1))}
                  disabled={!pagination.canGoNext}
                  className="w-7 h-7 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
