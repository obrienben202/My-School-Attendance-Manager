import { useState } from "react";
import { useLocation } from "wouter";
import {
  getListIlpsQueryKey,
  useCreateIlp,
  useDeleteIlp,
  useListIlps,
  useListStudents,
  useUpdateIlp,
  type Ilp,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IlpAdminNav } from "./_nav";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import { formatIlpDate, getIlpTutorName, getSectionProgressLabel } from "@/lib/ilp";

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-100 text-green-700 border-green-200",
  draft:     "bg-gray-100 text-gray-600 border-gray-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function AssignedIlps() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAssign, setShowAssign] = useState(false);
  const [showEdit, setShowEdit] = useState<Ilp | null>(null);
  const [showDelete, setShowDelete] = useState<Ilp | null>(null);
  const [newIlpTitle, setNewIlpTitle] = useState("");
  const [newLearner, setNewLearner] = useState("none");
  const [newTutor, setNewTutor] = useState("");
  const { data: assigned = [], isLoading, isError } = useListIlps();
  const { data: students = [] } = useListStudents();
  const createIlp = useCreateIlp();
  const updateIlp = useUpdateIlp();
  const deleteIlp = useDeleteIlp();
  const studentById = new Map(students.map((student) => [student.id, student]));
  const learnerName = (ilp: Ilp) => ilp.studentName ?? (() => {
    const student = studentById.get(ilp.studentId);
    return student ? `${student.forename} ${student.surname}` : "Unknown learner";
  })();

  const filtered = assigned.filter((a) => {
    const matchSearch = !search || learnerName(a).toLowerCase().includes(search.toLowerCase()) || a.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const refreshIlps = () => queryClient.invalidateQueries({ queryKey: getListIlpsQueryKey() });

  const doAssign = async () => {
    if (!newIlpTitle || newLearner === "none") return;
    await createIlp.mutateAsync({
      data: {
        studentId: Number(newLearner),
        title: newIlpTitle.trim(),
        tutor: newTutor.trim() || null,
        status: "draft",
        sections: [],
      },
    });
    await refreshIlps();
    setShowAssign(false);
    setNewIlpTitle(""); setNewLearner("none"); setNewTutor("");
  };

  const doDelete = async () => {
    if (!showDelete) return;
    await deleteIlp.mutateAsync({ id: showDelete.id });
    await refreshIlps();
    setShowDelete(null);
  };

  const doEdit = async () => {
    if (!showEdit) return;
    await updateIlp.mutateAsync({
      id: showEdit.id,
      data: {
        title: showEdit.title,
        tutor: showEdit.tutor,
        academicYear: showEdit.academicYear,
        lastReviewDate: showEdit.lastReviewDate,
        nextReviewDue: showEdit.nextReviewDue,
        status: showEdit.status,
        sections: showEdit.sections,
      },
    });
    await refreshIlps();
    setShowEdit(null);
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
                 <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Academic Year</th>
                 <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Review Dates</th>
                 <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Sections</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Status</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {isLoading ? (
                 <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">Loading assigned ILPs…</td></tr>
               ) : isError ? (
                 <tr><td colSpan={8} className="text-center py-10 text-red-600 text-sm">Assigned ILPs could not be loaded.</td></tr>
               ) : filtered.length === 0 ? (
                 <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">No assigned ILPs found.</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-blue-700">
                     <button className="hover:underline text-left" onClick={() => navigate(`/ilp-admin/learners?learnerId=${a.studentId}`)}>{a.title}</button>
                  </td>
                   <td className="px-4 py-2.5 text-gray-700">{learnerName(a)}</td>
                   <td className="px-4 py-2.5 text-gray-500 text-xs">{getIlpTutorName(a.tutor)}</td>
                   <td className="px-4 py-2.5 text-gray-500 text-xs">{a.academicYear ?? "—"}</td>
                   <td className="px-4 py-2.5 text-gray-500 text-xs">
                     <div>Last {formatIlpDate(a.lastReviewDate)}</div>
                     <div className="text-[10px] text-gray-400">Next {formatIlpDate(a.nextReviewDue)}</div>
                   </td>
                   <td className="px-4 py-2.5 text-gray-500 text-xs">{getSectionProgressLabel(a)}</td>
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
                 <Input value={showEdit.title} onChange={(e) => setShowEdit({ ...showEdit, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Tutor</label>
                 <Input value={showEdit.tutor ?? ""} onChange={(e) => setShowEdit({ ...showEdit, tutor: e.target.value || null })} />
                </div>
               <div>
                 <label className="text-xs font-semibold text-gray-600 block mb-1">Academic Year</label>
                 <Input value={showEdit.academicYear ?? ""} onChange={(e) => setShowEdit({ ...showEdit, academicYear: e.target.value || null })} />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-600 block mb-1">Last Review</label>
                   <Input type="date" value={showEdit.lastReviewDate ?? ""} onChange={(e) => setShowEdit({ ...showEdit, lastReviewDate: e.target.value || null })} />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-600 block mb-1">Next Review Due</label>
                   <Input type="date" value={showEdit.nextReviewDue ?? ""} onChange={(e) => setShowEdit({ ...showEdit, nextReviewDue: e.target.value || null })} />
                 </div>
               </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Status</label>
                   <Select value={showEdit.status} onValueChange={(status: Ilp["status"]) => setShowEdit({ ...showEdit, status })}>
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
               <Button onClick={doEdit} disabled={updateIlp.isPending} className="bg-teal-700 hover:bg-teal-800">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Unassign ILP?</DialogTitle></DialogHeader>
             <DialogDescription>This removes the saved ILP assignment from every workspace.</DialogDescription>
             <p className="text-sm text-gray-600">Remove the assignment of <strong>{showDelete?.title}</strong> from <strong>{showDelete ? learnerName(showDelete) : ""}</strong>?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
               <Button variant="destructive" onClick={doDelete} disabled={deleteIlp.isPending}>Unassign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
