import { useState } from "react";
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
import { MoreHorizontal, Pencil, Trash2, Layout } from "lucide-react";

type Section = {
  id: number;
  name: string;
  review: string;
  order: number;
};

const MOCK_SECTIONS: Section[] = [
  { id: 1, name: "Academic Progress", review: "Mid-Year Review", order: 1 },
  { id: 2, name: "Pastoral", review: "Mid-Year Review", order: 2 },
  { id: 3, name: "Achievement", review: "End-of-Year Review", order: 1 },
  { id: 4, name: "Next Steps", review: "End-of-Year Review", order: 2 },
  { id: 5, name: "Entry Information", review: "Initial Assessment Review", order: 1 },
];

const REVIEWS = ["Mid-Year Review", "End-of-Year Review", "Initial Assessment Review"];

export default function IlpSections() {
  const [sections, setSections] = useState<Section[]>(MOCK_SECTIONS);
  const [showEdit, setShowEdit] = useState<Section | null>(null);
  const [showDelete, setShowDelete] = useState<Section | null>(null);
  const [filterReview, setFilterReview] = useState("all");
  const [editName, setEditName] = useState("");

  const filtered = sections.filter((s) => filterReview === "all" || s.review === filterReview);

  const openEdit = (s: Section) => { setEditName(s.name); setShowEdit(s); };

  const doEdit = () => {
    setSections((prev) => prev.map((s) => s.id === showEdit?.id ? { ...s, name: editName } : s));
    setShowEdit(null);
  };

  const doDelete = () => {
    setSections((prev) => prev.filter((s) => s.id !== showDelete?.id));
    setShowDelete(null);
  };

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpAdminNav active="Sections" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Sections</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage the sections within ILP reviews. Edit section titles to update how they appear to tutors and learners.</p>
        </div>

        <div className="flex gap-2 mb-4">
          <Select value={filterReview} onValueChange={setFilterReview}>
            <SelectTrigger className="w-56 h-8 text-sm"><SelectValue placeholder="Filter by review…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reviews</SelectItem>
              {REVIEWS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} section{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Section Name</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Review</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Order</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No sections found.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 flex items-center gap-2">
                    <Layout size={13} className="text-rose-400 shrink-0" /> {s.name}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-xs">{s.review}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{s.order}</td>
                  <td className="px-4 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal size={15} /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm">
                        <DropdownMenuItem onClick={() => openEdit(s)}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setShowDelete(s)}><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit */}
        <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit Section</DialogTitle></DialogHeader>
            <div className="py-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Section Name *</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button onClick={doEdit} disabled={!editName.trim()} className="bg-teal-700 hover:bg-teal-800">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete */}
        <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Section?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">Delete <strong>{showDelete?.name}</strong> from <strong>{showDelete?.review}</strong>? This cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={doDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
