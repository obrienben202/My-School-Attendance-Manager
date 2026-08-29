import { useState } from "react";
import { useLocation } from "wouter";
import { useListEprogressions, useUpdateEprogression, useDeleteEprogression } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateOnly } from "@/lib/date-only";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, BookOpen, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Authorised: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

export default function EprogressionsHub() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const { data: progressions = [], refetch } = useListEprogressions({} as any);
  const { mutateAsync: updateProg } = useUpdateEprogression();
  const { mutateAsync: deleteProg } = useDeleteEprogression();

  const filtered = progressions.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchType = typeFilter === "all" || p.type === typeFilter;
    const matchSearch =
      !search ||
      p.courseCode.toLowerCase().includes(search.toLowerCase()) ||
      (p.submittedBy && p.submittedBy.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchType && matchSearch;
  });

  const pending = progressions.filter((p) => p.status === "Pending").length;
  const authorised = progressions.filter((p) => p.status === "Authorised").length;

  const authorise = async (id: number) => {
    await updateProg({ id, data: { status: "Authorised" } as any });
    await refetch();
  };

  const reject = async (id: number) => {
    await updateProg({ id, data: { status: "Rejected" } as any });
    await refetch();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await deleteProg({ id: confirmDelete });
    await refetch();
    setConfirmDelete(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">eProgressions</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Pending progress code changes awaiting authorisation. Submit new progressions from a learner or course record.
        </p>
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          <strong>Important:</strong> eProgressions do not update the source tables directly. Each submission is reviewed and authorised by an administrator before it takes effect.
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending", count: pending, color: "bg-amber-50 border-amber-200 text-amber-700", icon: Clock },
          { label: "Authorised", count: authorised, color: "bg-green-50 border-green-200 text-green-700", icon: CheckCircle },
          { label: "Total Submissions", count: progressions.length, color: "bg-blue-50 border-blue-200 text-blue-700", icon: Users },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className={`border rounded-lg p-4 flex items-center gap-3 ${color}`}>
            <Icon size={20} />
            <div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex gap-2 flex-wrap">
        <Input
          className="flex-1 min-w-[180px]"
          placeholder="Search by course code or submitted by…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Authorised">Authorised</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="learner">Learner</SelectItem>
            <SelectItem value="course">Course</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Progression Submissions</h2>
          <span className="text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Type</TableHead>
              <TableHead>Course Code</TableHead>
              <TableHead>Cal Occ Code</TableHead>
              <TableHead>Current Code</TableHead>
              <TableHead>New Code</TableHead>
              <TableHead>Progress Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-gray-400">
                  No eProgressions found.{" "}
                  <button
                    className="text-blue-500 underline"
                    onClick={() => setLocation("/students")}
                  >
                    Go to a learner record
                  </button>{" "}
                  or{" "}
                  <button
                    className="text-blue-500 underline"
                    onClick={() => setLocation("/courses")}
                  >
                    a course record
                  </button>{" "}
                  to submit progressions.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="text-sm">
                  <TableCell>
                    <span className="flex items-center gap-1 text-xs">
                      {p.type === "learner" ? (
                        <><Users size={12} className="text-blue-400" /> Learner</>
                      ) : (
                        <><BookOpen size={12} className="text-green-400" /> Course</>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono font-medium">{p.courseCode}</TableCell>
                  <TableCell className="text-gray-500">{p.calOccCode ?? "—"}</TableCell>
                  <TableCell>
                    {p.currentProgressCode ? (
                      <span className="font-mono font-semibold text-gray-600">{p.currentProgressCode}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {p.newProgressCode}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {formatDateOnly(p.progressDate)}
                  </TableCell>
                  <TableCell className="text-gray-500 max-w-[150px] truncate">
                    {p.reason ?? p.comments ?? "—"}
                  </TableCell>
                  <TableCell className="text-gray-400 text-xs">
                    {new Date(p.submittedAt).toLocaleDateString("en-GB")}
                    {p.submittedBy && <div className="truncate max-w-[100px]">{p.submittedBy}</div>}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {p.status === "Pending" && (
                        <>
                          <button
                            title="Authorise"
                            onClick={() => authorise(p.id)}
                            className="p-1 text-green-600 hover:text-green-800 rounded"
                          >
                            <CheckCircle size={15} />
                          </button>
                          <button
                            title="Reject"
                            onClick={() => reject(p.id)}
                            className="p-1 text-red-500 hover:text-red-700 rounded"
                          >
                            <XCircle size={15} />
                          </button>
                        </>
                      )}
                      <button
                        title="Delete"
                        onClick={() => setConfirmDelete(p.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete eProgression?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This will permanently remove the progression submission. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
