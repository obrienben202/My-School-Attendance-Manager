import { useLocation } from "wouter";
import { useListIlps, useListStudents } from "@workspace/api-client-react";
import { IlpTutorNav } from "./_nav";
import { Star, AlertTriangle, Clock, ChevronRight, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatIlpDate,
  formatIlpStatus,
  getIlpTutorName,
  getReviewStatus,
  getSectionProgressLabel,
  isIlpOpen,
} from "@/lib/ilp";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function IlpTutorHub() {
  const [, navigate] = useLocation();
  const { data: ilpRecords = [], isLoading, isError } = useListIlps();
  const { data: students = [] } = useListStudents();

  const studentById = new Map(students.map((student) => [student.id, student]));
  const ilps = ilpRecords.filter(isIlpOpen).map((ilp) => {
    const student = studentById.get(ilp.studentId);
    return {
      ...ilp,
      learnerName: ilp.studentName ?? (student ? `${student.forename} ${student.surname}` : "Unknown learner"),
      personCode: student?.personCode ?? "",
    };
  });

  const assignedCount = ilps.filter((ilp) => ilp.tutor).length;
  const scheduledReviews = ilps.filter((ilp) => ilp.nextReviewDue).length;
  const totalOverdue = ilps.filter((ilp) => getReviewStatus(ilp) === "Overdue").length;

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpTutorNav active="ILP Tutor" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">ILP Tutor</h1>
              <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-medium">
                Role: ILP Tutor
              </span>
            </div>
            <p className="text-sm text-gray-500">Open Individual Learning Plans and their saved review and section progress.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/ilp-tutor/learners")}>
              <Search size={13} /> Search Learners
            </Button>
            <Button size="sm" className="gap-1.5 text-xs bg-indigo-700 hover:bg-indigo-800" onClick={() => navigate("/ilp-tutor/reviews")}>
              <Star size={13} /> Reviews
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <BookOpen className="text-indigo-400 w-8 h-8" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{assignedCount}</p>
              <p className="text-xs text-gray-500">ILPs with a tutor</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <Star className="text-amber-400 w-8 h-8" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{scheduledReviews}</p>
              <p className="text-xs text-gray-500">Reviews scheduled</p>
            </div>
          </div>
          <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${totalOverdue > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
            <AlertTriangle className={`w-8 h-8 ${totalOverdue > 0 ? "text-red-400" : "text-gray-300"}`} />
            <div>
              <p className={`text-2xl font-bold ${totalOverdue > 0 ? "text-red-600" : "text-gray-900"}`}>{totalOverdue}</p>
              <p className="text-xs text-gray-500">Overdue reviews</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">Loading ILPs…</div>
        ) : isError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center text-sm text-red-700">ILPs could not be loaded.</div>
        ) : ilps.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">No open ILPs found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ilps.map((ilp) => (
            <div
              key={ilp.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(`/ilp-tutor/reviews?ilpId=${ilp.id}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{ilp.learnerName}</p>
                  <p className="text-xs text-gray-400 font-mono">{ilp.personCode}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ml-2 shrink-0 ${STATUS_STYLE[ilp.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {formatIlpStatus(ilp.status)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3 truncate">{ilp.title}</p>

              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between gap-2"><span>Tutor</span><span className="font-medium text-gray-700 truncate">{getIlpTutorName(ilp.tutor)}</span></div>
                <div className="flex justify-between gap-2"><span>Academic year</span><span className="font-medium text-gray-700">{ilp.academicYear ?? "—"}</span></div>
                <div className="flex justify-between gap-2"><span>Sections</span><span className="font-medium text-gray-700">{getSectionProgressLabel(ilp)}</span></div>
              </div>

              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock size={10} /> Next review {formatIlpDate(ilp.nextReviewDue)}</span>
                <ChevronRight size={13} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
          </div>
        )}

        {/* Closed ILPs link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Looking for a closed ILP?{" "}
            <button className="text-indigo-600 hover:underline font-medium" onClick={() => navigate("/ilp-tutor/learners")}>
              Search learners →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
