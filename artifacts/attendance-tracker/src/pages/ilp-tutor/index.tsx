import { useState } from "react";
import { useLocation } from "wouter";
import { useListStudents } from "@workspace/api-client-react";
import { IlpTutorNav } from "./_nav";
import { Star, Users, AlertTriangle, Clock, ChevronRight, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type LearnerIlp = {
  id: number;
  studentId: number;
  name: string;
  personCode: string;
  ilpTitle: string;
  owned: boolean;
  reviewCount: number;
  overdueReviews: number;
  status: "active" | "in-progress" | "completed";
  endDate: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  "in-progress": "In Progress",
  completed: "Completed",
};
const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  "in-progress": "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
};

const MOCK_ILP_DATA: Omit<LearnerIlp, "studentId" | "name" | "personCode">[] = [
  { id: 1, ilpTitle: "Level 3 BTEC ILP 2024", owned: true, reviewCount: 3, overdueReviews: 1, status: "active", endDate: "2025-07-31" },
  { id: 2, ilpTitle: "GCSE Resit Support Plan", owned: true, reviewCount: 2, overdueReviews: 0, status: "in-progress", endDate: "2025-05-30" },
  { id: 3, ilpTitle: "Access to HE ILP 2024", owned: false, reviewCount: 4, overdueReviews: 2, status: "active", endDate: "2025-06-30" },
  { id: 4, ilpTitle: "Level 2 Functional Skills", owned: true, reviewCount: 1, overdueReviews: 0, status: "active", endDate: "2025-08-31" },
  { id: 5, ilpTitle: "English GCSE ILP", owned: false, reviewCount: 3, overdueReviews: 1, status: "in-progress", endDate: "2025-05-15" },
];

export default function IlpTutorHub() {
  const [, navigate] = useLocation();
  const { data: students = [] } = useListStudents();

  const ilps: LearnerIlp[] = MOCK_ILP_DATA.map((d, i) => {
    const s = students[i] ?? { id: i + 1, forename: "Learner", surname: String(i + 1), personCode: `PC00${i + 1}` };
    return { ...d, studentId: s.id, name: `${s.forename} ${s.surname}`, personCode: s.personCode ?? "" };
  });

  const ownedCount = ilps.filter((l) => l.owned).length;
  const totalOverdue = ilps.reduce((sum, l) => sum + l.overdueReviews, 0);
  const totalReviews = ilps.reduce((sum, l) => sum + l.reviewCount, 0);

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
            <p className="text-sm text-gray-500">Your learners' open Individual Learning Plans. The number below each ILP shows reviews you own.</p>
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
              <p className="text-2xl font-bold text-gray-900">{ownedCount}</p>
              <p className="text-xs text-gray-500">ILPs you own</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <Star className="text-amber-400 w-8 h-8" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalReviews}</p>
              <p className="text-xs text-gray-500">Open reviews</p>
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

        {/* ILP cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ilps.map((ilp) => (
            <div
              key={ilp.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(`/ilp-tutor/reviews?learnerId=${ilp.studentId}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{ilp.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{ilp.personCode}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ml-2 shrink-0 ${STATUS_STYLE[ilp.status]}`}>
                  {STATUS_LABEL[ilp.status]}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3 truncate">{ilp.ilpTitle}</p>

              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Star size={11} className="text-amber-400" />
                    <span className="font-semibold text-gray-700">{ilp.reviewCount}</span> review{ilp.reviewCount !== 1 ? "s" : ""}
                  </span>
                  {ilp.overdueReviews > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertTriangle size={11} />
                      <span className="font-semibold">{ilp.overdueReviews}</span> overdue
                    </span>
                  )}
                </div>
                {!ilp.owned && (
                  <span className="text-[10px] text-gray-400 italic">Not owner</span>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock size={10} /> Ends {new Date(ilp.endDate).toLocaleDateString("en-GB")}</span>
                <ChevronRight size={13} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>

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
