import { useState } from "react";
import { useLocation } from "wouter";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Star, UserCheck, AlertTriangle, Clock, BookOpen } from "lucide-react";
import {
  formatIlpDate,
  formatIlpStatus,
  getReviewStatus,
  getSectionProgressLabel,
  isIlpOpen,
  isTutorOwner,
} from "@/lib/ilp";

const STATUS_STYLE: Record<string, string> = {
  active:        "bg-green-100 text-green-700 border-green-200",
  draft:         "bg-amber-100 text-amber-700 border-amber-200",
  completed:     "bg-blue-100 text-blue-700 border-blue-200",
};

export default function IlpTutorIlps() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: ilpRecords = [], isLoading, isError } = useListIlps();
  const { data: students = [] } = useListStudents();
  const updateIlp = useUpdateIlp();
  const [showOwnership, setShowOwnership] = useState<Ilp | null>(null);

  const userName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Staff Member";
  const studentById = new Map(students.map((student) => [student.id, student]));
  const ilps = ilpRecords.filter(isIlpOpen);
  const learnerName = (ilp: Ilp) => ilp.studentName ?? (() => {
    const student = studentById.get(ilp.studentId);
    return student ? `${student.forename} ${student.surname}` : "Unknown learner";
  })();

  const takeOwnership = async () => {
    if (!showOwnership) return;
    await updateIlp.mutateAsync({ id: showOwnership.id, data: { tutor: userName } });
    await queryClient.invalidateQueries({ queryKey: getListIlpsQueryKey() });
    setShowOwnership(null);
  };

  const open = ilps;

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpTutorNav active="My Learners' ILPs" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">My Learners' ILPs</h1>
          <p className="text-sm text-gray-500 mt-0.5">All open ILPs for your learners. ILPs past their end date are closed overnight by a nightly workflow.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <BookOpen size={14} className="text-indigo-400" />
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Open ILPs</span>
              <span className="ml-auto text-xs text-gray-400">{open.length} ILP{open.length !== 1 ? "s" : ""}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Learner</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">ILP Title</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Status</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Review Dates</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Review</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Ownership</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Year / Sections</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {isLoading ? (
                 <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">Loading ILPs…</td></tr>
               ) : isError ? (
                 <tr><td colSpan={8} className="text-center py-8 text-red-600 text-sm">ILPs could not be loaded.</td></tr>
               ) : open.length === 0 ? (
                 <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">No open ILPs.</td></tr>
              ) : open.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                     <button className="font-medium text-blue-700 hover:underline text-sm" onClick={() => navigate(`/ilp-tutor/learners?name=${encodeURIComponent(learnerName(r))}`)}>
                       {learnerName(r)}
                    </button>
                     <p className="text-xs text-gray-400 font-mono">{studentById.get(r.studentId)?.personCode ?? ""}</p>
                  </td>
                   <td className="px-4 py-2.5 text-gray-700 text-xs">{r.title}</td>
                  <td className="px-4 py-2.5">
                     <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>{formatIlpStatus(r.status)}</span>
                  </td>
                   <td className="px-4 py-2.5 text-gray-500 text-xs">
                     <div className="flex items-center gap-1"><Clock size={10} /> Next {formatIlpDate(r.nextReviewDue)}</div>
                     <div className="mt-1 text-[10px] text-gray-400">Last {formatIlpDate(r.lastReviewDate)}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                     {getReviewStatus(r) === "Overdue" ? (
                      <span className="flex items-center gap-1 text-red-500 font-semibold">
                         <AlertTriangle size={11} /> Overdue
                      </span>
                    ) : (
                       <span className="text-gray-500">{getReviewStatus(r)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                     {isTutorOwner(r.tutor, userName) ? (
                      <span className="flex items-center gap-1 text-indigo-700 font-semibold"><UserCheck size={12} /> Owner</span>
                    ) : (
                      <button
                        className="text-gray-400 hover:text-indigo-600 underline"
                        onClick={() => setShowOwnership(r)}
                      >
                        Take ownership
                      </button>
                    )}
                  </td>
                   <td className="px-4 py-2.5 text-xs text-gray-500">{r.academicYear ?? "—"}<br />{getSectionProgressLabel(r)}</td>
                  <td className="px-4 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal size={15} /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm">
                         <DropdownMenuItem onClick={() => navigate(`/ilp-tutor/reviews?ilpId=${r.id}`)}>
                          <Star size={13} className="mr-2" /> View reviews
                        </DropdownMenuItem>
                         {!isTutorOwner(r.tutor, userName) && (
                          <DropdownMenuItem onClick={() => setShowOwnership(r)}>
                            <UserCheck size={13} className="mr-2" /> Take ownership
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Take Ownership dialog */}
        <Dialog open={!!showOwnership} onOpenChange={() => setShowOwnership(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>ILP Ownership</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">
               Take ownership of <strong>{showOwnership?.title}</strong> for <strong>{showOwnership ? learnerName(showOwnership) : ""}</strong>?
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
              Taking ownership of a single record will not update the count on your review page. To update the count, take ownership of the learner.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOwnership(null)}>Cancel</Button>
               <Button onClick={takeOwnership} disabled={updateIlp.isPending} className="bg-indigo-700 hover:bg-indigo-800">Take ownership</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
