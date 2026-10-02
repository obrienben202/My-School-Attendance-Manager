import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
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
import { PlusCircle, MoreHorizontal, Pencil, Trash2, X, Plus, Layers } from "lucide-react";

type FilterDef = { field: string; operator: string; value: string };
type Group = {
  id: number;
  name: string;
  filters: FilterDef[];
  learnerCount: number | null;
  associatedIlps: number;
  createdAt: string | null;
  createdBy: string;
};

const FILTER_FIELDS = ["Year Group", "Course", "Attendance %", "Status", "Faculty", "Gender"];
const FILTER_OPS = ["equals", "contains", "is greater than", "is less than", "is not"];

const INITIAL_GROUPS: Group[] = [7, 8, 9, 10, 11].map(year => ({
  id: year,
  name: `Year ${year}`,
  filters: [{ field: "Year Group", operator: "equals", value: `Year ${year}` }],
  learnerCount: null,
  associatedIlps: 0,
  createdAt: null,
  createdBy: "IT Admin",
}));

const emptyFilter = (): FilterDef => ({ field: "Year Group", operator: "equals", value: "" });

export default function IlpGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<Group | null>(null);
  const [showDelete, setShowDelete] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: "", filters: [emptyFilter()] });

  const openCreate = () => { setForm({ name: "", filters: [emptyFilter()] }); setShowCreate(true); };
  const openEdit = (g: Group) => { setForm({ name: g.name, filters: g.filters.length ? [...g.filters] : [emptyFilter()] }); setShowEdit(g); };

  const setFilter = (idx: number, patch: Partial<FilterDef>) => {
    setForm((prev) => ({ ...prev, filters: prev.filters.map((f, i) => i === idx ? { ...f, ...patch } : f) }));
  };

  const addFilter = () => setForm((prev) => ({ ...prev, filters: [...prev.filters, emptyFilter()] }));
  const removeFilter = (idx: number) => setForm((prev) => ({ ...prev, filters: prev.filters.filter((_, i) => i !== idx) }));

  const doCreate = () => {
    setGroups((prev) => [
      ...prev,
      { id: Date.now(), name: form.name, filters: form.filters, learnerCount: null, associatedIlps: 0, createdAt: new Date().toISOString().split("T")[0], createdBy: [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.username || "Not recorded" },
    ]);
    setShowCreate(false);
  };

  const doEdit = () => {
    setGroups((prev) => prev.map((g) => g.id === showEdit?.id ? { ...g, name: form.name, filters: form.filters } : g));
    setShowEdit(null);
  };

  const doDelete = () => {
    setGroups((prev) => prev.filter((g) => g.id !== showDelete?.id));
    setShowDelete(null);
  };

  const FilterEditor = () => (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-600 block">Filters</label>
      {form.filters.map((f, idx) => (
        <div key={idx} className="flex gap-1.5 items-center">
          <Select value={f.field} onValueChange={(v) => setFilter(idx, { field: v })}>
            <SelectTrigger className="flex-1 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FILTER_FIELDS.map((ff) => <SelectItem key={ff} value={ff} className="text-xs">{ff}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.operator} onValueChange={(v) => setFilter(idx, { operator: v })}>
            <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FILTER_OPS.map((op) => <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="w-28 h-7 text-xs" value={f.value} onChange={(e) => setFilter(idx, { value: e.target.value })} placeholder="Value…" />
          <button onClick={() => removeFilter(idx)} className="text-gray-400 hover:text-red-500 p-0.5"><X size={13} /></button>
        </div>
      ))}
      <button onClick={addFilter} className="flex items-center gap-1 text-xs text-teal-700 hover:text-teal-800 font-medium mt-1">
        <Plus size={12} /> Add filter
      </button>
    </div>
  );

  return (
    <div className="flex -mx-6 -mt-6 min-h-screen bg-slate-50">
      <IlpAdminNav active="Groups" />
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Groups</h1>
            <p className="text-sm text-gray-500 mt-0.5">Define learner groups using filter criteria. Groups can only be deleted if not associated with an ILP.</p>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-teal-700 hover:bg-teal-800">
            <PlusCircle size={15} /> Create group
          </Button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Group Name</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Filters</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Learners</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Associated ILPs</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Created</th>
                <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Created by</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No groups created yet.</td></tr>
              ) : groups.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 flex items-center gap-2">
                    <Layers size={14} className="text-violet-400 shrink-0" /> {g.name}
                  </td>
                  <td className="px-4 py-2.5">
                    {g.filters.length === 0 ? (
                      <span className="text-xs text-gray-400">No filters</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {g.filters.map((f, i) => (
                          <span key={i} className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5">
                            {f.field} {f.operator} {f.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium">{g.learnerCount ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`px-2 py-0.5 rounded font-medium ${g.associatedIlps > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                      {g.associatedIlps}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{g.createdAt ? new Date(g.createdAt).toLocaleDateString("en-GB") : "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{g.createdBy}</td>
                  <td className="px-4 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal size={15} /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm">
                        <DropdownMenuItem onClick={() => openEdit(g)}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          className={g.associatedIlps > 0 ? "opacity-40 cursor-not-allowed" : "text-red-600"}
                          onClick={() => g.associatedIlps === 0 && setShowDelete(g)}
                        >
                          <Trash2 size={13} className="mr-2" />
                          {g.associatedIlps > 0 ? "Cannot delete (in use)" : "Delete"}
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
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Group Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Year 7" />
              </div>
              <FilterEditor />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={doCreate} disabled={!form.name.trim()} className="bg-teal-700 hover:bg-teal-800">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit */}
        <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Group</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Group Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <FilterEditor />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button onClick={doEdit} disabled={!form.name.trim()} className="bg-teal-700 hover:bg-teal-800">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete */}
        <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Group?</DialogTitle></DialogHeader>
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
