import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IlpAdminNav } from "./_nav";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, FileText } from "lucide-react";

type Header = {
  id: number;
  name: string;
  description: string;
  associatedIlps: number;
  createdAt: string;
};

const MOCK_HEADERS: Header[] = [
  { id: 1, name: "Academic Year 2024-25", description: "Standard header for the 2024–2025 academic year.", associatedIlps: 14, createdAt: "2024-08-01" },
  { id: 2, name: "GCSE Resit Programme", description: "Header for learners on GCSE resit programmes.", associatedIlps: 6, createdAt: "2024-08-15" },
  { id: 3, name: "Access to HE Pathway", description: "Header for Access to Higher Education learners.", associatedIlps: 3, createdAt: "2024-09-01" },
  { id: 4, name: "Unused Template 2023", description: "Legacy template, no longer in use.", associatedIlps: 0, createdAt: "2023-08-01" },
];

export default function IlpHeaders() {
  const [headers, setHeaders] = useState<Header[]>(MOCK_HEADERS);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<Header | null>(null);
  const [showDelete, setShowDelete] = useState<Header | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const openCreate = () => { setForm({ name: "", description: "" }); setShowCreate(true); };
  const openEdit = (h: Header) => { setForm({ name: h.name, description: h.description }); setShowEdit(h); };

  const doCreate = () => {
    setHeaders((prev) => [
      ...prev,
      { id: Date.now(), name: form.name, description: form.description, associatedIlps: 0, createdAt: new Date().toISOString().split("T")[0] },
    ]);
    setShowCreate(false);
  };

  const doEdit = () => {
    setHeaders((prev) => prev.map((h) => h.id === showEdit?.id ? { ...h, ...form } : h));
    setShowEdit(null);
  };

  const doDelete = () => {
    setHeaders((prev) => prev.filter((h) => h.id !== showDelete?.id));
    setShowDelete(null);
  };

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpAdminNav active="Headers" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Headers</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage ILP headers. Headers structure the ILP template shown to learners and tutors.</p>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-teal-700 hover:bg-teal-800">
            <PlusCircle size={15} /> Create header
          </Button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Header Name</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Description</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Associated ILPs</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Created</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {headers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No headers created yet. Click <strong>Create header</strong> to add one.</td></tr>
              ) : headers.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 flex items-center gap-2">
                    <FileText size={14} className="text-indigo-400 shrink-0" />
                    {h.name}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate">{h.description || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`px-2 py-0.5 rounded font-medium ${h.associatedIlps > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                      {h.associatedIlps}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(h.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal size={15} /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm">
                        <DropdownMenuItem onClick={() => openEdit(h)}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          className={h.associatedIlps > 0 ? "opacity-40 cursor-not-allowed" : "text-red-600"}
                          onClick={() => h.associatedIlps === 0 && setShowDelete(h)}
                        >
                          <Trash2 size={13} className="mr-2" />
                          {h.associatedIlps > 0 ? "Cannot delete (in use)" : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Header</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Header Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Academic Year 2025-26" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description…" rows={3} className="text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={doCreate} disabled={!form.name.trim()} className="bg-teal-700 hover:bg-teal-800">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit */}
        <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Header</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Header Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button onClick={doEdit} disabled={!form.name.trim()} className="bg-teal-700 hover:bg-teal-800">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Header?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">Delete <strong>{showDelete?.name}</strong>? This cannot be undone.</p>
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
