import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getListIlpsQueryKey,
  useListIlps,
  useListStudents,
  useUpdateIlp,
  type Ilp,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { IlpTutorNav } from "./_nav";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Star, AlertTriangle, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { formatIlpDate, getIlpTutorName, getReviewStatus, isIlpOpen, isTutorOwner } from "@/lib/ilp";

type ReviewStatus = "Overdue" | "In Progress" | "In Review";

type Review = {
  id: number;
  learnerName: string;
  learnerId: number;
  reviewName: string;
  dueDate: string;
  status: ReviewStatus;
  ownedByMe: boolean;
  ownerName: string;
};

const STATUS_STYLES: Record<ReviewStatus, string> = {
  "Overdue":     "bg-red-100 text-red-700 border-red-200",
  "In Progress": "bg-amber-100 text-amber-700 border-amber-200",
  "In Review":   "bg-blue-100 text-blue-700 border-blue-200",
};

const STATUS_ICONS: Record<ReviewStatus, React.FC<{ size?: number; className?: string }>> = {
  "Overdue":     ({ size, className }) => <AlertTriangle size={size} className={className} />,
  "In Progress": ({ size, className }) => <Clock size={size} className={className} />,
  "In Review":   ({ size, className }) => <CheckCircle2 size={size} className={className} />,
};

const STATUS_CHART_COLORS: Record<ReviewStatus, string> = {
  "Overdue":     "bg-red-400",
  "In Progress": "bg-amber-400",
  "In Review":   "bg-blue-400",
};

const ALL_STATUSES: ReviewStatus[] = ["Overdue", "In Progress", "In Review"];

export default function IlpTutorReviews() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const initialLearner = params.get("learnerId") ?? "all";
  const initialIlpId = params.get("ilpId");

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: ilpRecords = [], isLoading, isError } = useListIlps();
  const { data: students = [] } = useListStudents();
  const updateIlp = useUpdateIlp();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [learnerFilter, setLearnerFilter] = useState<string>(initialLearner);
  const [excludeOthers, setExcludeOthers] = useState(false);
  const [chartFilter, setChartFilter] = useState<ReviewStatus | null>(null);

  const userName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Staff Member";
  const studentById = new Map(students.map((student) => [student.id, student]));
  const learnerName = (ilp: Ilp) => ilp.studentName ?? (() => {
    const student = studentById.get(ilp.studentId);
    return student ? `${student.forename} ${student.surname}` : "Unknown learner";
  })();
  const reviews: Review[] = ilpRecords.filter(isIlpOpen).map((ilp) => ({
    id: ilp.id,
    learnerName: learnerName(ilp),
    learnerId: ilp.studentId,
    reviewName: ilp.title,
    dueDate: ilp.nextReviewDue ?? ilp.lastReviewDate ?? ilp.createdAt,
    status: getReviewStatus(ilp),
    ownedByMe: isTutorOwner(ilp.tutor, userName),
    ownerName: getIlpTutorName(ilp.tutor),
  }));

  const takeOwnership = async (id: number) => {
    await updateIlp.mutateAsync({ id, data: { tutor: userName } });
    await queryClient.invalidateQueries({ queryKey: getListIlpsQueryKey() });
  };

  const filtered = reviews.filter((r) => {
    const matchStatus = statusFilter === "all" ? true : r.status === statusFilter;
    const matchLearner = learnerFilter === "all" ? true : String(r.learnerId) === learnerFilter;
    const matchIlp = initialIlpId ? String(r.id) === initialIlpId : true;
    const matchOwner = !excludeOthers ? true : r.ownedByMe;
    const matchChart = !chartFilter ? true : r.status === chartFilter;
    return matchStatus && matchLearner && matchIlp && matchOwner && matchChart;
  });

  // Chart data
  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = reviews.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<ReviewStatus, number>);
  const total = reviews.length;

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpTutorNav active="Reviews" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">ILP reviews for your learners. Click a status segment to filter the list.</p>
        </div>

        {/* Overview panel / chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Overview</p>
          <div className="flex gap-4 items-center flex-wrap">
            {/* Stacked bar */}
            <div className="flex-1 min-w-40">
              <div className="flex rounded-full overflow-hidden h-3 gap-px">
                {ALL_STATUSES.map((s) => {
                  const pct = total ? (counts[s] / total) * 100 : 33;
                  return (
                    <button
                      key={s}
                      title={`${s}: ${counts[s]}`}
                      onClick={() => setChartFilter(chartFilter === s ? null : s)}
                      className={`h-full transition-opacity ${STATUS_CHART_COLORS[s]} ${chartFilter && chartFilter !== s ? "opacity-30" : "opacity-100"}`}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>
              {chartFilter && (
                <p className="text-xs text-gray-400 mt-1">Filtering by: <strong>{chartFilter}</strong> — <button className="text-indigo-600 hover:underline" onClick={() => setChartFilter(null)}>clear</button></p>
              )}
            </div>
            {/* Legend */}
            <div className="flex gap-4 flex-wrap">
              {ALL_STATUSES.map((s) => {
                const Icon = STATUS_ICONS[s];
                return (
                  <button
                    key={s}
                    onClick={() => setChartFilter(chartFilter === s ? null : s)}
                    className={`flex items-center gap-1.5 text-xs transition-opacity ${chartFilter && chartFilter !== s ? "opacity-30" : "opacity-100"}`}
                  >
                    <Icon size={13} className={s === "Overdue" ? "text-red-500" : s === "In Progress" ? "text-amber-500" : "text-blue-500"} />
                    <span className="font-semibold text-gray-700">{counts[s]}</span>
                    <span className="text-gray-500">{s}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <Select value={learnerFilter} onValueChange={setLearnerFilter}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All learners" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All learners</SelectItem>
              {students.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.forename} {s.surname}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer ml-2">
            <button
              role="switch"
              aria-checked={excludeOthers}
              onClick={() => setExcludeOthers((v) => !v)}
              className={`relative w-8 h-4 rounded-full transition-colors ${excludeOthers ? "bg-indigo-600" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${excludeOthers ? "left-4.5 translate-x-0.5" : "left-0.5"}`} />
            </button>
            Exclude owned by others
          </label>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} review{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Reviews table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Learner</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Review</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Due Date</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Status</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Owner</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">Loading reviews…</td></tr>
              ) : isError ? (
                <tr><td colSpan={6} className="text-center py-12 text-red-600 text-sm">Reviews could not be loaded.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No reviews match your filters.</td></tr>
              ) : filtered.map((r) => {
                const Icon = STATUS_ICONS[r.status];
                const isOverdue = r.status === "Overdue";
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-blue-700">
                      <button className="hover:underline" onClick={() => navigate(`/ilp-tutor/learners?name=${encodeURIComponent(r.learnerName)}`)}>
                        {r.learnerName}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 text-xs font-medium">{r.reviewName}</td>
                    <td className={`px-4 py-2.5 text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                       {formatIlpDate(r.dueDate)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLES[r.status]}`}>
                        <Icon size={10} /> {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {r.ownedByMe ? <span className="font-semibold text-indigo-700">You</span> : r.ownerName}
                    </td>
                    <td className="px-4 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal size={15} /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-sm">
                          <DropdownMenuItem onClick={() => navigate(`/ilp-tutor/review/${r.id}`)}>
                            <ExternalLink size={13} className="mr-2" /> Open review
                          </DropdownMenuItem>
                          {!r.ownedByMe && (
                             <DropdownMenuItem onClick={() => takeOwnership(r.id)} disabled={updateIlp.isPending}>
                              <Star size={13} className="mr-2" /> Make me owner
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
