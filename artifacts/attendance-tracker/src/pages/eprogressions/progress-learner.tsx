import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetStudent,
  useListCourses,
  useListEprogressions,
  useCreateEprogression,
  useDeleteEprogression,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, CheckCircle, Trash2 } from "lucide-react";

const PROGRESS_CODES = [
  { code: "A", label: "A — Continuing" },
  { code: "B", label: "B — Completed" },
  { code: "D", label: "D — Discontinued" },
  { code: "E", label: "E — Excluded" },
  { code: "F", label: "F — Failed" },
  { code: "L", label: "L — Learner left" },
  { code: "P", label: "P — Passed" },
  { code: "Q", label: "Q — Qualified" },
  { code: "R", label: "R — Re-enrolled" },
  { code: "T", label: "T — Transferred" },
  { code: "U", label: "U — Unknown" },
  { code: "W", label: "W — Withdrawn" },
  { code: "X", label: "X — Not completed" },
];

type RowState = {
  newProgressCode: string;
  progressDate: string;
  comments: string;
  reason: string;
};

export default function ProgressLearner() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<Record<number, RowState>>({});

  const { data: student } = useGetStudent(id, { query: { enabled: !!id } as any });
  const { data: courses = [] } = useListCourses({} as any);
  const { data: pending = [], refetch } = useListEprogressions(
    { studentId: id } as any,
    { query: { enabled: !!id } as any }
  );
  const { mutateAsync: createProg } = useCreateEprogression();
  const { mutateAsync: deleteProg } = useDeleteEprogression();

  const today = new Date().toISOString().split("T")[0];

  const getRow = (courseId: number): RowState =>
    rows[courseId] ?? { newProgressCode: "", progressDate: today, comments: "", reason: "" };

  const setRow = (courseId: number, patch: Partial<RowState>) =>
    setRows((prev) => ({
      ...prev,
      [courseId]: { ...getRow(courseId), ...patch },
    }));

  const dirtyRows = courses.filter((c) => rows[c.id]?.newProgressCode);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      for (const course of dirtyRows) {
        const r = getRow(course.id);
        await createProg({
          data: {
            type: "learner",
            studentId: id,
            courseId: course.id,
            courseCode: course.code,
            calOccCode: (course as any).calOccCode ?? null,
            currentProgressCode: (course as any).progressCode ?? "A",
            newProgressCode: r.newProgressCode,
            progressDate: r.progressDate,
            comments: r.comments || null,
            reason: r.reason || null,
            status: "Pending",
            submittedBy: student ? `${student.forename} ${student.surname}` : undefined,
          } as any,
        });
      }
      await refetch();
      setRows({});
      setSubmitting(false);
      setShowConfirm(false);
      setSubmitted(true);
    } catch {
      setSubmitting(false);
    }
  };

  const deletePending = async (progId: number) => {
    await deleteProg({ id: progId });
    await refetch();
  };

  const displayName = student ? `${student.forename} ${student.surname}` : "Learner";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/students/${id}`)}>
          <ArrowLeft size={16} className="mr-1" /> {displayName}
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Progress Learner</h1>
          <p className="text-sm text-gray-500">{displayName}</p>
        </div>
      </div>

      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
        Select a <strong>New Progress Code</strong> and <strong>Progress Date</strong> for one or more courses below, then click <strong>Submit</strong>. The eProgression will be placed in a pending queue for authorisation.
      </div>

      {/* Progress grid */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Enrolled Courses</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Course Code</TableHead>
                <TableHead className="whitespace-nowrap">Cal Occ Code</TableHead>
                <TableHead className="whitespace-nowrap">Current Progress Code</TableHead>
                <TableHead className="whitespace-nowrap min-w-[180px]">New Progress Code</TableHead>
                <TableHead className="whitespace-nowrap min-w-[150px]">Progress Date</TableHead>
                <TableHead className="whitespace-nowrap min-w-[160px]">Comments</TableHead>
                <TableHead className="whitespace-nowrap min-w-[160px]">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    No enrolled courses found
                  </TableCell>
                </TableRow>
              ) : (
                courses.map((course) => {
                  const row = getRow(course.id);
                  return (
                    <TableRow key={course.id} className={row.newProgressCode ? "bg-blue-50/40" : ""}>
                      <TableCell>
                        <button
                          className="font-mono font-medium text-blue-600 hover:underline text-sm"
                          onClick={() => setLocation(`/courses/${course.id}`)}
                        >
                          {course.code}
                        </button>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm font-mono">
                        {(course as any).calOccCode ?? course.code + "-01"}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-sm">
                          {(course as any).progressCode ?? "A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.newProgressCode || "none"}
                          onValueChange={(v) => setRow(course.id, { newProgressCode: v === "none" ? "" : v })}
                        >
                          <SelectTrigger className="h-8 text-sm w-full">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— No change —</SelectItem>
                            {PROGRESS_CODES.map(({ code, label }) => (
                              <SelectItem key={code} value={code}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.progressDate}
                          onChange={(e) => setRow(course.id, { progressDate: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.comments}
                          onChange={(e) => setRow(course.id, { comments: e.target.value })}
                          placeholder="Comments…"
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.reason}
                          onChange={(e) => setRow(course.id, { reason: e.target.value })}
                          placeholder="Reason…"
                          className="h-8 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end mb-8">
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={dirtyRows.length === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Submit ({dirtyRows.length} progression{dirtyRows.length !== 1 ? "s" : ""})
        </Button>
      </div>

      {/* Pending Progressions */}
      {pending.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Pending Progressions</h2>
            <span className="text-xs text-gray-400">{pending.length} submission{pending.length !== 1 ? "s" : ""}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Course Code</TableHead>
                <TableHead>Current Code</TableHead>
                <TableHead>New Code</TableHead>
                <TableHead>Progress Date</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-medium text-sm">{p.courseCode}</TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold text-gray-600 bg-gray-100 px-1.5 rounded">
                      {p.currentProgressCode ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {p.newProgressCode}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(p.progressDate).toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{p.comments ?? "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">{p.reason ?? "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === "Pending" ? "bg-amber-100 text-amber-700"
                      : p.status === "Authorised" ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                    }`}>
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.status === "Pending" && (
                      <button
                        onClick={() => deletePending(p.id)}
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Confirm modal */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit eProgressions?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              You are about to submit <strong>{dirtyRows.length}</strong> progression{dirtyRows.length !== 1 ? "s" : ""} for{" "}
              <strong>{displayName}</strong>.
            </p>
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              This will not update the source tables directly. The submission will appear on the Agent Progressions tab for authorisation.
            </p>
            <ul className="text-xs text-gray-500 space-y-1 mt-2">
              {dirtyRows.map((c) => {
                const r = getRow(c.id);
                return (
                  <li key={c.id} className="flex gap-2">
                    <span className="font-mono">{c.code}</span>
                    <span>→</span>
                    <span className="font-mono font-bold text-blue-700">{r.newProgressCode}</span>
                    <span className="text-gray-400">({new Date(r.progressDate).toLocaleDateString("en-GB")})</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success modal */}
      <Dialog open={submitted} onOpenChange={setSubmitted}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle size={20} /> eProgression Submitted
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            The eProgression has been submitted successfully and is now awaiting authorisation.
          </p>
          <DialogFooter>
            <Button onClick={() => setSubmitted(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
