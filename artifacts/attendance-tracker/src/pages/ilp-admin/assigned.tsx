import { useState } from "react";
import { useLocation } from "wouter";
import { useListIlps, useListStudents } from "@workspace/api-client-react";
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
import { IlpAdminNav } from "./_nav";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-100 text-green-700 border-green-200",
  draft:     "bg-gray-100 text-gray-600 border-gray-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
};

type AssignedIlp = {
  id: number;
  ilpTitle: string;
  learnerName: string;
  learnerId: number;
  tutor: string;
  dateAssigned: string;
  status: string;
};

const MOCK_ASSIGNED: AssignedIlp[] = [
  { id: 1, ilpTitle: "Level 3 BTEC ILP 2024", learnerName: "Jordan Patel", learnerId: 1, tutor: "Ms. Harper", dateAssigned: "2024-09-05", status: "active" },
  { id: 2, ilpTitle: "GCSE Resit Support Plan", learnerName: "Amy Chen", learnerId: 2, tutor: "Mr. Davies", dateAssigned: "2024-09-10", status: "active" },
  { id: 3, ilpTitle: "English GCSE ILP", learnerName: "Sam Okafor", learnerId: 3, tutor: "Ms. Harper", dateAssigned: "2024-09-01", status: "draft" },
  { id: 4, ilpTitle: "Access to HE ILP 2024", learnerName: "Priya Sharma", learnerId: 4, tutor: "Dr. Ellis", dateAssigned: "2024-08-28", status: "completed" },
];

export default function AssignedIlps() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigned, setAssigned] = useState<AssignedIlp[]>(MOCK_ASSIGNED);
  const [showAssign, setShowAssign] = useState(false);
  const [showEdit, setShowEdit] = useState<AssignedIlp | null>(null);
  const [showDelete, setShowDelete] = useState<AssignedIlp | null>(null);
  const [newIlpTitle, setNewIlpTitle] = useState("");
  const [newLearner, setNewLearner] = useState("none");
  const [newTutor, setNewTutor] = useState("");
  const { data: students = [] } = useListStudents();

  const filtered = assigned.filter((a) => {
    const matchSearch = !search || a.learnerName.toLowerCase().includes(search.toLowerCase()) || a.ilpTitle.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const doAssign = () => {
    if (!newIlpTitle || newLearner === "none") return;
    const s = students.find((s) => String(s.id) === newLearner);
    setAssigned((prev) => [
      ...prev,
      {
        id: Date.now(),
        ilpTitle: newIlpTitle,
        learnerName: s ? `${s.forename} ${s.surname}` : "Unknown",
        learnerId: s?.id ?? 0,
        tutor: newTutor || "Unassigned",
        dateAssigned: new Date().toISOString().split("T")[0],
        status: "draft",
      },
    ]);
    setShowAssign(false);
    setNewIlpTitle(""); setNewLearner("none"); setNewTutor("");
  };

  const doDelete = () => {
    if (!showDelete) return;
    setAssigned((prev) => prev.filter((a) => a.id !== showDelete.id));
    setShowDelete(null);
  };

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpAdminNav active="Assigned ILPs" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assigned ILPs</h1>
            <p className="text-sm text-gray-500 mt-0.5">ILPs that have been assigned to learners.</p>
          </div>
          <Button onClick={() => setShowAssign(true)} className="gap-2 bg-teal-700 hover:bg-teal-800">
            <UserPlus size={15} /> Assign ILP
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <Input className="flex-1 h-8 text-sm" placeholder="Search by learner or ILP title…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">ILP Title</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Learner</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Tutor</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Date Assigned</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Status</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No assigned ILPs found.</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-blue-700">
                    <button className="hover:underline text-left" onClick={() => navigate(`/ilp-admin/learners?learnerId=${a.learnerId}`)}>{a.ilpTitle}</button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{a.learnerName}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{a.tutor}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(a.dateAssigned).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${STATUS_STYLES[a.status] ?? "bg-gray-100 text-gray-600"}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal size={15} /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm">
                        <DropdownMenuItem onClick={() => setShowEdit(a)}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setShowDelete(a)}><Trash2 size={13} className="mr-2" /> Unassign</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Assign ILP dialog */}
        <Dialog open={showAssign} onOpenChange={setShowAssign}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Assign ILP</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">ILP Title</label>
                <Input value={newIlpTitle} onChange={(e) => setNewIlpTitle(e.target.value)} placeholder="e.g. Level 3 BTEC ILP 2025" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Learner</label>
                <Select value={newLearner} onValueChange={setNewLearner}>
                  <SelectTrigger><SelectValue placeholder="Select learner…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select learner —</SelectItem>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.surname}, {s.forename}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Tutor</label>
                <Input value={newTutor} onChange={(e) => setNewTutor(e.target.value)} placeholder="Tutor name" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
              <Button onClick={doAssign} disabled={!newIlpTitle || newLearner === "none"} className="bg-teal-700 hover:bg-teal-800">Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit dialog */}
        <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Assignment</DialogTitle></DialogHeader>
            {showEdit && (
              <div className="space-y-3 py-2">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">ILP Title</label>
                  <Input value={showEdit.ilpTitle} onChange={(e) => setShowEdit({ ...showEdit, ilpTitle: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Tutor</label>
                  <Input value={showEdit.tutor} onChange={(e) => setShowEdit({ ...showEdit, tutor: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Status</label>
                  <Select value={showEdit.status} onValueChange={(v) => setShowEdit({ ...showEdit, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button onClick={() => {
                setAssigned((prev) => prev.map((a) => a.id === showEdit?.id ? showEdit : a));
                setShowEdit(null);
              }} className="bg-teal-700 hover:bg-teal-800">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Unassign ILP?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">Remove the assignment of <strong>{showDelete?.ilpTitle}</strong> from <strong>{showDelete?.learnerName}</strong>?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={doDelete}>Unassign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
