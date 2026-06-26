import { useState } from "react";
import { useLocation } from "wouter";
import { useListStudents } from "@workspace/api-client-react";
import { IlpTutorNav } from "./_nav";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Star, UserCheck, AlertTriangle, Clock, BookOpen, XCircle } from "lucide-react";

type LearnerIlpRow = {
  id: number;
  studentId: number;
  learnerName: string;
  personCode: string;
  ilpTitle: string;
  status: string;
  owned: boolean;
  endDate: string;
  overdueReviews: number;
};

const STATUS_STYLE: Record<string, string> = {
  active:        "bg-green-100 text-green-700 border-green-200",
  "in-progress": "bg-amber-100 text-amber-700 border-amber-200",
  completed:     "bg-blue-100 text-blue-700 border-blue-200",
  abandoned:     "bg-gray-100 text-gray-500 border-gray-200",
};

const MOCK: Omit<LearnerIlpRow, "studentId" | "learnerName" | "personCode">[] = [
  { id: 1, ilpTitle: "Level 3 BTEC ILP 2024",    status: "active",        owned: true,  endDate: "2025-07-31", overdueReviews: 1 },
  { id: 2, ilpTitle: "GCSE Resit Support Plan",   status: "in-progress",   owned: true,  endDate: "2025-05-30", overdueReviews: 0 },
  { id: 3, ilpTitle: "Access to HE ILP 2024",     status: "active",        owned: false, endDate: "2025-06-30", overdueReviews: 2 },
  { id: 4, ilpTitle: "Level 2 Functional Skills", status: "active",        owned: true,  endDate: "2025-08-31", overdueReviews: 0 },
  { id: 5, ilpTitle: "English GCSE ILP",          status: "in-progress",   owned: false, endDate: "2025-05-15", overdueReviews: 1 },
];

export default function IlpTutorIlps() {
  const [, navigate] = useLocation();
  const { data: students = [] } = useListStudents();
  const [ilps, setIlps] = useState<LearnerIlpRow[]>(
    MOCK.map((d, i) => {
      const s = students[i] ?? { id: i + 1, forename: "Learner", surname: String(i + 1), personCode: `PC00${i + 1}` };
      return { ...d, studentId: s.id, learnerName: `${s.forename} ${s.surname}`, personCode: s.personCode ?? "" };
    })
  );
  const [showAbandon, setShowAbandon] = useState<LearnerIlpRow | null>(null);
  const [showOwnership, setShowOwnership] = useState<LearnerIlpRow | null>(null);

  const takeOwnership = (id: number) => {
    setIlps((prev) => prev.map((r) => r.id === id ? { ...r, owned: true } : r));
    setShowOwnership(null);
  };

  const doAbandon = () => {
    setIlps((prev) => prev.map((r) => r.id === showAbandon?.id ? { ...r, status: "abandoned" } : r));
    setShowAbandon(null);
  };

  const open = ilps.filter((r) => r.status !== "abandoned");
  const abandoned = ilps.filter((r) => r.status === "abandoned");

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
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">End Date</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Overdue</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Ownership</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {open.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No open ILPs.</td></tr>
              ) : open.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <button className="font-medium text-blue-700 hover:underline text-sm" onClick={() => navigate(`/ilp-tutor/learners?name=${encodeURIComponent(r.learnerName)}`)}>
                      {r.learnerName}
                    </button>
                    <p className="text-xs text-gray-400 font-mono">{r.personCode}</p>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 text-xs">{r.ilpTitle}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${STATUS_STYLE[r.status]}`}>{r.status.replace("-", " ")}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs flex items-center gap-1">
                    <Clock size={10} /> {new Date(r.endDate).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {r.overdueReviews > 0 ? (
                      <span className="flex items-center gap-1 text-red-500 font-semibold">
                        <AlertTriangle size={11} /> {r.overdueReviews}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {r.owned ? (
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
                  <td className="px-4 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal size={15} /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm">
                        <DropdownMenuItem onClick={() => navigate(`/ilp-tutor/reviews?learnerId=${r.studentId}`)}>
                          <Star size={13} className="mr-2" /> View reviews
                        </DropdownMenuItem>
                        {!r.owned && (
                          <DropdownMenuItem onClick={() => setShowOwnership(r)}>
                            <UserCheck size={13} className="mr-2" /> Take ownership
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-red-600" onClick={() => setShowAbandon(r)}>
                          <XCircle size={13} className="mr-2" /> Abandon ILP
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {abandoned.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <XCircle size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Abandoned ILPs</span>
              <span className="ml-auto text-xs text-gray-400">{abandoned.length}</span>
            </div>
            <div className="p-4 space-y-2">
              {abandoned.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm text-gray-400 bg-gray-50 border border-gray-100 rounded px-3 py-2">
                  <span>{r.learnerName} — {r.ilpTitle}</span>
                  <span className="text-xs">Abandoned</span>
                </div>
              ))}
            </div>
            <div className="px-4 pb-3 text-xs text-gray-400">
              Once all learner ILPs have been closed, the ILP is no longer displayed on the ILP Tutor homepage.
            </div>
          </div>
        )}

        {/* Take Ownership dialog */}
        <Dialog open={!!showOwnership} onOpenChange={() => setShowOwnership(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>ILP Ownership</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">
              Take ownership of <strong>{showOwnership?.ilpTitle}</strong> for <strong>{showOwnership?.learnerName}</strong>?
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
              Taking ownership of a single record will not update the count on your review page. To update the count, take ownership of the learner.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOwnership(null)}>Cancel</Button>
              <Button onClick={() => takeOwnership(showOwnership!.id)} className="bg-indigo-700 hover:bg-indigo-800">Take ownership</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Abandon ILP dialog */}
        <Dialog open={!!showAbandon} onOpenChange={() => setShowAbandon(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Abandon ILP?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">
              Abandon <strong>{showAbandon?.ilpTitle}</strong> for <strong>{showAbandon?.learnerName}</strong>? This will mark the ILP as abandoned.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAbandon(null)}>Cancel</Button>
              <Button variant="destructive" onClick={doAbandon}>Abandon ILP</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
