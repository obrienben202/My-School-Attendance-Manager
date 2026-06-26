import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListConciergeApplications,
  useListStudents,
  useCreateConciergeApplication,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Search, Plus, ChevronRight } from "lucide-react";

const STATUSES = ["Applied", "Under Review", "Interview Scheduled", "Offer Made", "Accepted", "Rejected", "Withdrawn"];

const statusColor = (s: string) => {
  const m: Record<string, string> = {
    Applied: "bg-blue-100 text-blue-700",
    "Under Review": "bg-yellow-100 text-yellow-700",
    "Interview Scheduled": "bg-purple-100 text-purple-700",
    "Offer Made": "bg-indigo-100 text-indigo-700",
    Accepted: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    Withdrawn: "bg-gray-100 text-gray-700",
  };
  return m[s] ?? "bg-gray-100 text-gray-700";
};

export default function ConciergeApplications() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);

  // New application form
  const [newForename, setNewForename] = useState("");
  const [newSurname, setNewSurname] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newStatus, setNewStatus] = useState("Applied");
  const [saving, setSaving] = useState(false);

  const { data: applications = [], refetch } = useListConciergeApplications({} as any);
  const { data: students = [] } = useListStudents({} as any);
  const { mutateAsync: createApp } = useCreateConciergeApplication();

  const getStudentName = (studentId: number | null | undefined) => {
    if (!studentId) return null;
    const s = students.find((s) => s.id === studentId);
    return s ? `${s.forename} ${s.surname}` : `Learner #${studentId}`;
  };

  const displayName = (a: (typeof applications)[0]) =>
    getStudentName(a.studentId) ?? (`${a.forename ?? ""} ${a.surname ?? ""}`.trim() || "Unknown");

  const filtered = applications.filter((a) => {
    const matchSearch =
      !search ||
      displayName(a).toLowerCase().includes(search.toLowerCase()) ||
      (a.email && a.email.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!newForename || !newSurname) return;
    setSaving(true);
    try {
      const created = await createApp({
        data: { forename: newForename, surname: newSurname, email: newEmail || null, status: newStatus },
      });
      await refetch();
      setShowNew(false);
      setNewForename(""); setNewSurname(""); setNewEmail(""); setNewStatus("Applied");
      setLocation(`/concierge/applications/${created.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/concierge")}>
          <ArrowLeft size={16} className="mr-1" /> Concierge
        </Button>
        <h1 className="text-xl font-bold text-gray-900">Applications</h1>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={() => setShowNew(true)}>
            <Plus size={16} /> New Application
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Applications</h2>
          <span className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Applicant</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Interview</TableHead>
              <TableHead>Offer</TableHead>
              <TableHead>Date Applied</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                  No applications found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setLocation(`/concierge/applications/${a.id}`)}
                >
                  <TableCell className="font-medium">{displayName(a)}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{a.email ?? "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}>
                      {a.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {a.interviewDate
                      ? new Date(a.interviewDate).toLocaleDateString("en-GB")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {a.offerType ? (
                      <span className="text-indigo-600 font-medium">{a.offerType}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(a.createdAt).toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell>
                    <ChevronRight size={16} className="text-gray-400" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* New Application dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Forename <span className="text-red-500">*</span></Label>
              <Input value={newForename} onChange={(e) => setNewForename(e.target.value)} />
            </div>
            <div>
              <Label>Surname <span className="text-red-500">*</span></Label>
              <Input value={newSurname} onChange={(e) => setNewSurname(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div>
              <Label>Initial Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newForename || !newSurname || saving}>
              {saving ? "Creating…" : "Create Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
