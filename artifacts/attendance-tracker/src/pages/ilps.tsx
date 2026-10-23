import { useState } from "react";
import {
  getListIlpsQueryKey,
  useCreateIlp,
  useListIlps,
  useListStudents,
  useUpdateIlp,
  type Ilp,
  type IlpSectionState,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, PlusCircle } from "lucide-react";

type IlpForm = {
  studentId: string;
  title: string;
  tutor: string;
  academicYear: string;
  status: "draft" | "active" | "completed";
  lastReviewDate: string;
  nextReviewDue: string;
  sections: string;
};

const EMPTY_FORM: IlpForm = {
  studentId: "",
  title: "",
  tutor: "",
  academicYear: "",
  status: "active",
  lastReviewDate: "",
  nextReviewDue: "",
  sections: "",
};

function sectionLines(sections: IlpSectionState[]): string {
  return sections.map((section) => `${section.name} | ${section.status}`).join("\n");
}

function parseSections(value: string): IlpSectionState[] {
  return value.split(/\r?\n/).map((line) => {
    const [name, rawStatus] = line.split("|").map((part) => part.trim());
    const status: IlpSectionState["status"] = rawStatus === "completed" || rawStatus === "partial" ? rawStatus : "not_started";
    return { name, status };
  }).filter((section) => section.name);
}

export default function Ilps() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: ilps, isLoading } = useListIlps();
  const { data: students = [] } = useListStudents();
  const createIlp = useCreateIlp();
  const updateIlp = useUpdateIlp();
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Ilp | null>(null);
  const [form, setForm] = useState<IlpForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const filteredIlps = ilps?.filter(ilp => statusFilter === "all" || ilp.status === statusFilter);
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setForm((current) => ({ ...current, studentId: students[0] ? String(students[0].id) : "" }));
    setFormVisible(true);
  };

  const openEdit = (ilp: Ilp) => {
    setEditing(ilp);
    setForm({
      studentId: String(ilp.studentId),
      title: ilp.title,
      tutor: ilp.tutor ?? "",
      academicYear: ilp.academicYear ?? "",
      status: ilp.status,
      lastReviewDate: ilp.lastReviewDate ?? "",
      nextReviewDue: ilp.nextReviewDue ?? "",
      sections: sectionLines(ilp.sections),
    });
    setFormError("");
    setFormVisible(true);
  };

  const saveIlp = async () => {
    if (!form.studentId || !form.title.trim()) {
      setFormError("Select a learner and enter an ILP title.");
      return;
    }
    const data = {
      title: form.title.trim(),
      tutor: form.tutor.trim() || null,
      academicYear: form.academicYear.trim() || null,
      status: form.status,
      lastReviewDate: form.lastReviewDate || null,
      nextReviewDue: form.nextReviewDue || null,
      sections: parseSections(form.sections),
    };
    if (editing) await updateIlp.mutateAsync({ id: editing.id, data });
    else await createIlp.mutateAsync({ data: { ...data, studentId: Number(form.studentId) } });
    await queryClient.invalidateQueries({ queryKey: getListIlpsQueryKey() });
    setFormVisible(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Individual Learning Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage student ILPs.</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <PlusCircle className="w-4 h-4" /> Create ILP
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4 border-b flex flex-row items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">ILP Records</CardTitle>
          </div>
          <div className="flex gap-2">
             <Button variant={statusFilter === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("all")}>All</Button>
             <Button variant={statusFilter === "active" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("active")}>Active</Button>
             <Button variant={statusFilter === "draft" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("draft")}>Draft</Button>
             <Button variant={statusFilter === "completed" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("completed")}>Completed</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4"><Skeleton className="h-12 w-full" /></div>
            ))
          ) : filteredIlps?.length ? (
            filteredIlps.map(ilp => (
              <div key={ilp.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{ilp.title}</h3>
                    <Badge variant={ilp.status === 'active' ? 'default' : ilp.status === 'completed' ? 'outline' : 'secondary'} className="capitalize text-[10px] px-1.5 py-0">
                      {ilp.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Learner: {ilp.studentName}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEdit(ilp)}>Edit</Button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground">No ILPs found.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formVisible} onOpenChange={(open) => { setFormVisible(open); if (!open) { setEditing(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Update ILP" : "Create ILP"}</DialogTitle>
            <DialogDescription>Maintain the tutor, review schedule, and section completion used by ILP reports.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium">Learner</label>
              <Select value={form.studentId} onValueChange={(studentId) => setForm((current) => ({ ...current, studentId }))} disabled={Boolean(editing)}>
                <SelectTrigger><SelectValue placeholder="Select learner" /></SelectTrigger>
                <SelectContent>{students.map((student) => <SelectItem key={student.id} value={String(student.id)}>{student.surname}, {student.forename}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium">ILP title</label>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Tutor</label>
              <Input value={form.tutor} onChange={(event) => setForm((current) => ({ ...current, tutor: event.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Academic year</label>
              <Input value={form.academicYear} onChange={(event) => setForm((current) => ({ ...current, academicYear: event.target.value }))} placeholder="2026/27" />
            </div>
            <div>
              <label className="text-xs font-medium">Last review</label>
              <Input type="date" value={form.lastReviewDate} onChange={(event) => setForm((current) => ({ ...current, lastReviewDate: event.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Next review due</label>
              <Input type="date" value={form.nextReviewDue} onChange={(event) => setForm((current) => ({ ...current, nextReviewDue: event.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium">Status</label>
              <Select value={form.status} onValueChange={(status) => setForm((current) => ({ ...current, status: status as IlpForm["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium">Section completion</label>
              <textarea className="mt-1 min-h-28 w-full rounded-md border px-3 py-2 text-sm" value={form.sections} onChange={(event) => setForm((current) => ({ ...current, sections: event.target.value }))} placeholder={"Learning Goals | completed\nSupport Needs | partial"} />
              <p className="text-xs text-muted-foreground">One section per line. Use completed, partial, or not_started after the | character.</p>
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormVisible(false); setEditing(null); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button onClick={saveIlp} disabled={createIlp.isPending || updateIlp.isPending}>Save ILP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
