import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useListStudents } from "@workspace/api-client-react";
import { IlpTutorNav } from "./_nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Users, Star, Target, ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

type ReviewSummary = {
  reviewName: string;
  status: "Overdue" | "In Progress" | "In Review";
  dueDate: string;
};

type TargetSummary = {
  title: string;
  status: "On Track" | "At Risk" | "Achieved";
};

type LearnerDetail = {
  id: number;
  forename: string;
  surname: string;
  personCode: string;
  yearGroup?: string | null;
  ilpTitle: string;
  ilpStatus: string;
  reviews: ReviewSummary[];
  targets: TargetSummary[];
};

const STATUS_STYLES: Record<string, string> = {
  "Overdue":     "bg-red-100 text-red-700 border-red-200",
  "In Progress": "bg-amber-100 text-amber-700 border-amber-200",
  "In Review":   "bg-blue-100 text-blue-700 border-blue-200",
  "On Track":    "bg-green-100 text-green-700 border-green-200",
  "At Risk":     "bg-red-100 text-red-600 border-red-200",
  "Achieved":    "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const MOCK_REVIEWS: ReviewSummary[][] = [
  [
    { reviewName: "Mid-Year Review", status: "Overdue", dueDate: "2025-01-15" },
    { reviewName: "Target Check-In", status: "In Progress", dueDate: "2025-03-01" },
  ],
  [
    { reviewName: "Initial Review", status: "In Review", dueDate: "2025-02-20" },
  ],
  [
    { reviewName: "End-of-Year Review", status: "In Progress", dueDate: "2025-05-30" },
    { reviewName: "Mid-Year Review", status: "Overdue", dueDate: "2025-01-10" },
  ],
  [
    { reviewName: "Mid-Year Review", status: "In Review", dueDate: "2025-03-15" },
  ],
  [
    { reviewName: "Target Check-In", status: "Overdue", dueDate: "2025-01-20" },
    { reviewName: "Initial Review", status: "In Progress", dueDate: "2025-02-28" },
  ],
];

const MOCK_TARGETS: TargetSummary[][] = [
  [{ title: "Improve Maths grade to C", status: "On Track" }, { title: "Complete EPQ project", status: "At Risk" }],
  [{ title: "Submit all coursework on time", status: "Achieved" }],
  [{ title: "Improve attendance to 90%", status: "At Risk" }, { title: "Pass English GCSE resit", status: "On Track" }],
  [{ title: "Complete functional skills unit", status: "On Track" }],
  [{ title: "Apply for apprenticeship", status: "At Risk" }, { title: "Achieve D* in BTEC", status: "On Track" }],
];

const ILP_TITLES = [
  "Level 3 BTEC ILP 2024",
  "GCSE Resit Support Plan",
  "Access to HE ILP 2024",
  "Level 2 Functional Skills",
  "English GCSE ILP",
];
const ILP_STATUSES = ["active", "active", "in-progress", "active", "in-progress"];

export default function IlpTutorLearners() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);

  const { data: students = [] } = useListStudents();
  const [search, setSearch] = useState(params.get("name") ?? "");
  const [searched, setSearched] = useState(!!params.get("name"));
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (params.get("name")) { setSearch(params.get("name")!); setSearched(true); }
  }, []);

  const learnerDetails: LearnerDetail[] = students.slice(0, 5).map((s, i) => ({
    id: s.id,
    forename: s.forename,
    surname: s.surname,
    personCode: s.personCode ?? `PC00${i + 1}`,
    yearGroup: s.yearGroup,
    ilpTitle: ILP_TITLES[i % ILP_TITLES.length],
    ilpStatus: ILP_STATUSES[i % ILP_STATUSES.length],
    reviews: MOCK_REVIEWS[i % MOCK_REVIEWS.length],
    targets: MOCK_TARGETS[i % MOCK_TARGETS.length],
  }));

  const filtered = !searched ? [] : learnerDetails.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.forename.toLowerCase().includes(q) ||
      l.surname.toLowerCase().includes(q) ||
      `${l.forename} ${l.surname}`.toLowerCase().includes(q) ||
      l.personCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpTutorNav active="Learner Search" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Learner Search</h1>
          <p className="text-sm text-gray-500 mt-0.5">Search by first name, surname or person code. Includes closed ILPs.</p>
        </div>

        <div className="flex gap-2 mb-5">
          <Input
            className="flex-1 h-9 text-sm"
            placeholder="Search by learner name or person code…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearched(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") setSearched(true); }}
          />
          <Button className="h-9 bg-indigo-700 hover:bg-indigo-800 gap-1.5 text-sm" onClick={() => setSearched(true)}>
            <Search size={14} /> Search
          </Button>
        </div>

        {!searched ? (
          <div className="bg-white border border-gray-200 rounded-lg p-14 flex flex-col items-center text-gray-400">
            <Users className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Enter a name or person code to search.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-14 flex flex-col items-center text-gray-400">
            <Search className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">No learners found for "<strong>{search}</strong>".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((l) => {
              const isExpanded = expanded === l.id;
              const overdueCount = l.reviews.filter((r) => r.status === "Overdue").length;
              return (
                <div key={l.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {/* Learner row */}
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => setExpanded(isExpanded ? null : l.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                        {l.forename[0]}{l.surname[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{l.surname}, {l.forename}</p>
                        <p className="text-xs text-gray-400 font-mono">{l.personCode}{l.yearGroup ? ` · ${l.yearGroup}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-gray-500"><Star size={11} className="text-amber-400" /> {l.reviews.length} review{l.reviews.length !== 1 ? "s" : ""}</span>
                      <span className="flex items-center gap-1 text-gray-500"><Target size={11} className="text-indigo-400" /> {l.targets.length} target{l.targets.length !== 1 ? "s" : ""}</span>
                      {overdueCount > 0 && (
                        <span className="flex items-center gap-1 text-red-500 font-semibold"><AlertTriangle size={11} /> {overdueCount} overdue</span>
                      )}
                      <span className="text-gray-300">{isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Current ILP</p>
                        <p className="text-sm font-semibold text-gray-800">{l.ilpTitle}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Reviews */}
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Star size={10} className="text-amber-400" /> Reviews & History
                          </p>
                          <div className="space-y-1.5">
                            {l.reviews.map((r, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2 text-xs cursor-pointer hover:border-indigo-300"
                                onClick={() => navigate(`/ilp-tutor/review/${l.id * 10 + i + 1}`)}
                              >
                                <div>
                                  <p className="font-medium text-gray-700">{r.reviewName}</p>
                                  <p className="text-gray-400">Due {new Date(r.dueDate).toLocaleDateString("en-GB")}</p>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Targets */}
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Target size={10} className="text-indigo-400" /> Targets
                          </p>
                          <div className="space-y-1.5">
                            {l.targets.map((t, i) => (
                              <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2 text-xs">
                                <p className="font-medium text-gray-700 flex-1 min-w-0 pr-2 truncate">{t.title}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="text-xs h-7 bg-indigo-700 hover:bg-indigo-800" onClick={() => navigate(`/ilp-tutor/reviews?learnerId=${l.id}`)}>
                          View all reviews
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => navigate(`/students/${l.id}`)}>
                          Learner profile
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
