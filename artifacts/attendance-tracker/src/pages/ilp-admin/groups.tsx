import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListIlpGroups, getListIlpGroupsQueryKey, useCreateIlpGroup, useUpdateIlpGroup, useDeleteIlpGroup,
  type IlpGroup as Group, type IlpGroupFilter as FilterDef,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Link } from "wouter";
import { errorMessage, useTermlyAdmin } from "@/hooks/use-termly";
import { termlyForms, templateEditorLink } from "@/components/termly/form-associations";
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

const FILTER_FIELDS = ["Year Group"] as const;
const FILTER_OPS = ["equals", "is not"] as const;
const emptyFilter = (): FilterDef => ({ field: "Year Group", operator: "equals", value: "Year 7" });

export default function IlpGroups() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const queryClient = useQueryClient();
  const savedGroups = useListIlpGroups({
    request: { cache: "no-store" },
    query: {
      queryKey: [...getListIlpGroupsQueryKey(), user?.id ?? "anon"],
      enabled: !!user, staleTime: 10000, gcTime: 0, refetchInterval: 30000, retry: false,
    },
  });
  const groups = savedGroups.data ?? [];
  const createGroup = useCreateIlpGroup();
  const updateGroup = useUpdateIlpGroup();
  const deleteGroup = useDeleteIlpGroup();
  const busy = createGroup.isPending || updateGroup.isPending || deleteGroup.isPending;
  const [saveError, setSaveError] = useState<string | null>(null);
  const termly = useTermlyAdmin();
  const forms = termlyForms(termly.data?.templates ?? []);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<Group | null>(null);
  const [showDelete, setShowDelete] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: "", filters: [emptyFilter()] });

  const openCreate = () => { setSaveError(null); setForm({ name: "", filters: [emptyFilter()] }); setShowCreate(true); };
  const openEdit = (g: Group) => { setSaveError(null); setForm({ name: g.name, filters: [...g.filters] }); setShowEdit(g); };

  const setFilter = (idx: number, patch: Partial<FilterDef>) => {
    setForm((prev) => ({ ...prev, filters: prev.filters.map((f, i) => i === idx ? { ...f, ...patch } : f) }));
  };

  const addFilter = () => setForm((prev) => ({ ...prev, filters: [...prev.filters, emptyFilter()] }));
  const removeFilter = (idx: number) => setForm((prev) => ({ ...prev, filters: prev.filters.filter((_, i) => i !== idx) }));

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListIlpGroupsQueryKey() });
  const doCreate = async () => {
    setSaveError(null);
    try {
      await createGroup.mutateAsync({ data: form });
      await refresh();
      setShowCreate(false);
    } catch (error) { setSaveError(errorMessage(error)); }
  };

  const doEdit = async () => {
    if (!showEdit) return;
    setSaveError(null);
    try {
      await updateGroup.mutateAsync({ id: showEdit.id, data: form });
      await refresh();
      setShowEdit(null);
    } catch (error) { setSaveError(errorMessage(error)); }
  };

  const doDelete = async () => {
    if (!showDelete || showDelete.defaultYear !== null) return;
    setSaveError(null);
    try {
      await deleteGroup.mutateAsync({ id: showDelete.id });
      await refresh();
      setShowDelete(null);
    } catch (error) { setSaveError(errorMessage(error)); }
  };

  const renderFilters = () => (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-600 block">Filters</label>
      <p className="text-xs text-gray-500">All filters must match. Only Year Group is supported, using confirmed Year 7–11 roster learners. No filters includes all of these learners.</p>
      {form.filters.map((f, idx) => (
        <div key={idx} className="flex gap-1.5 items-center">
          <Select value={f.field} onValueChange={(v) => setFilter(idx, { field: v as FilterDef["field"] })}>
            <SelectTrigger className="flex-1 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FILTER_FIELDS.map((ff) => <SelectItem key={ff} value={ff} className="text-xs">{ff}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.operator} onValueChange={(v) => setFilter(idx, { operator: v as FilterDef["operator"] })}>
            <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FILTER_OPS.map((op) => <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.value.startsWith("Year ") ? f.value : `Year ${f.value}`} onValueChange={(v) => setFilter(idx, { value: v })}>
            <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[7, 8, 9, 10, 11].map(year => <SelectItem key={year} value={`Year ${year}`}>Year {year}</SelectItem>)}</SelectContent>
          </Select>
          <button onClick={() => removeFilter(idx)} className="text-gray-400 hover:text-red-500 p-0.5"><X size={13} /></button>
        </div>
      ))}
      <button disabled={form.filters.length >= 20} onClick={addFilter} className="flex items-center gap-1 text-xs text-teal-700 hover:text-teal-800 font-medium mt-1">
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
            <p className="text-sm text-gray-500 mt-0.5">Shared, saved learner groups. Year 7–11 defaults cannot be deleted. Custom group deletion does not change forms or learner reviews.</p>
            <p className="text-xs text-gray-500 mt-1">Associated ILPs lists the shared Term 1–3 form catalogue, not saved group assignments.</p>
          </div>
          <Button disabled={!canManage || savedGroups.isLoading || savedGroups.isError || busy} onClick={openCreate} className="gap-2 bg-teal-700 hover:bg-teal-800">
            <PlusCircle size={15} /> Create group
          </Button>
        </div>

        {savedGroups.isError && <div role="alert" className="mb-4 text-red-700">
          <p>Unable to load saved groups: {errorMessage(savedGroups.error)}</p>
          <button className="underline" onClick={() => savedGroups.refetch()}>Retry</button>
        </div>}
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
              {savedGroups.isLoading ? <tr><td colSpan={7} className="py-10 text-center">Loading saved groups…</td></tr> : savedGroups.isError ? null : groups.length === 0 ? (
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
                    {termly.isLoading ? <span>Loading forms…</span> : termly.isError ? (
                      <div role="alert" className="text-red-700">
                        <p>{errorMessage(termly.error)}</p>
                        <button className="underline" onClick={() => termly.refetch()}>Retry</button>
                      </div>
                    ) : (
                      <div className="space-y-1" data-testid={`associated-ilps-${g.id}`}>
                        <span className="inline-block rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">{forms.length} termly form{forms.length === 1 ? "" : "s"}</span>
                        <ul className="space-y-1">
                          {forms.map(template => <li key={template.id}>
                            <Link className="font-medium text-teal-700 underline" href={templateEditorLink(template.id)}>
                              Term {template.term} ILP · v{template.version}
                            </Link>
                            <span className="ml-1 text-gray-500">({template.status})</span>
                          </li>)}
                        </ul>
                        {forms.length === 0 && <Link className="block text-teal-700 underline" href="/ilp-admin/headers">Set up Term 1–3 forms</Link>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{g.createdAt ? new Date(g.createdAt).toLocaleDateString("en-GB") : "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{g.createdBy}</td>
                  <td className="px-4 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button disabled={!canManage || busy} aria-label={`Actions for ${g.name}`} className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal size={15} /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm">
                        <DropdownMenuItem onClick={() => openEdit(g)}><Pencil size={13} className="mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={g.defaultYear !== null}
                          className={g.defaultYear !== null ? "opacity-40 cursor-not-allowed" : "text-red-600"}
                          onClick={() => { setSaveError(null); setShowDelete(g); }}
                        >
                          <Trash2 size={13} className="mr-2" />
                          {g.defaultYear !== null ? "Cannot delete (default)" : "Delete"}
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
        <Dialog open={showCreate} onOpenChange={open => { if (!busy) setShowCreate(open); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Group Name *</label>
                <Input maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Year 7" />
              </div>
              {renderFilters()}
              {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
            </div>
            <DialogFooter>
              <Button disabled={busy} variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={doCreate} disabled={busy || !form.name.trim()} className="bg-teal-700 hover:bg-teal-800">{busy ? "Saving…" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit */}
        <Dialog open={!!showEdit} onOpenChange={() => { if (!busy) setShowEdit(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Group</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Group Name *</label>
                <Input maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              {renderFilters()}
              {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
            </div>
            <DialogFooter>
              <Button disabled={busy} variant="outline" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button onClick={doEdit} disabled={busy || !form.name.trim()} className="bg-teal-700 hover:bg-teal-800">{busy ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete */}
        <Dialog open={!!showDelete} onOpenChange={() => { if (!busy) setShowDelete(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Group?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">Delete <strong>{showDelete?.name}</strong>? This cannot be undone. Termly forms and learner reviews will not be deleted or changed.</p>
            {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
            <DialogFooter>
              <Button disabled={busy} variant="outline" onClick={() => setShowDelete(null)}>Cancel</Button>
              <Button disabled={busy} variant="destructive" onClick={doDelete}>{busy ? "Deleting…" : "Delete"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
