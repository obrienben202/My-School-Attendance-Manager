import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  type Eprogression,
  useGetCourse,
  useListStudents,
  useListEprogressions,
  useCreateEprogression,
  useDeleteEprogression,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatDateOnly, toLocalDateOnlyValue } from "@/lib/date-only";
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
import { ArrowLeft, CheckCircle, Trash2, ChevronsDown } from "lucide-react";

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

type FillTarget = { field: keyof RowState; fromIdx: number };

export default function EnrolmentProgressions() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [completedRecords, setCompletedRecords] = useState<Eprogression[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fillMsg, setFillMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const { toast } = useToast();

  const today = toLocalDateOnlyValue();

  const { data: course } = useGetCourse(id, { query: { enabled: !!id } as any });
  const { data: allStudents = [] } = useListStudents();
  const { data: pending = [], refetch } = useListEprogressions(
    { courseId: id } as any,
    { query: { enabled: !!id } as any }
  );
  const { mutateAsync: createProg } = useCreateEprogression();
  const { mutateAsync: deleteProg } = useDeleteEprogression();

  // Use first N students as enrolled (same heuristic as course-detail)
  const enrolled = allStudents.slice(0, course?.enrolledCount ?? 10);

  const getRow = (studentId: number): RowState =>
    rows[studentId] ?? { newProgressCode: "", progressDate: today, comments: "", reason: "" };

  const setRow = (studentId: number, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [studentId]: { ...getRow(studentId), ...patch } }));

  // Fill Down: flood-fill the given field value downward from fromIdx
  const fillDown = (field: keyof RowState, fromIdx: number, value: string) => {
    const toFill = enrolled.slice(fromIdx + 1);
    setRows((prev) => {
      const next = { ...prev };
      toFill.forEach((s) => {
        next[s.id] = { ...getRow(s.id), ...next[s.id], [field]: value };
      });
      return next;
    });
    setFillMsg(`Fill Down applied — ${toFill.length} row${toFill.length !== 1 ? "s" : ""} updated.`);
  };

  const dirtyRows = enrolled.filter((s) => rows[s.id]?.newProgressCode);
  const invalidRows = dirtyRows.filter((student) => !getRow(student.id).progressDate);

  const openConfirmation = () => {
    if (dirtyRows.length === 0 || submittingRef.current) return;
    if (invalidRows.length > 0) {
      setSubmitError("Choose a progress date for every selected learner.");
      return;
    }
    setSubmitError(null);
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    if (!course || submittingRef.current || dirtyRows.length === 0) return;
    if (invalidRows.length > 0) {
      setSubmitError("Choose a progress date for every selected learner.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await Promise.all(dirtyRows.map(async (student) => {
        const r = getRow(student.id);
        return createProg({
          data: {
            type: "course",
            studentId: student.id,
            courseId: id,
            courseCode: course.code,
            calOccCode: (course as any).calOccCode ?? `${course.code}-01`,
            currentProgressCode: "A",
            newProgressCode: r.newProgressCode,
            progressDate: r.progressDate,
            comments: r.comments || null,
            reason: r.reason || null,
            status: "Pending",
            submittedBy: `${student.forename} ${student.surname}`,
          },
        });
      }));
      await refetch();
      setRows({});
      setShowConfirm(false);
      setCompletedRecords(saved);
      toast({
        title: "eProgressions saved",
        description: `${saved.length} progression${saved.length === 1 ? "" : "s"} now await authorisation.`,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The progressions could not be saved. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const courseName = course ? `${course.code} — ${course.name}` : "Course";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/courses/${id}`)}>
          <ArrowLeft size={16} className="mr-1" /> {course?.code ?? "Course"}
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Enrolment Progressions</h1>
          <p className="text-sm text-gray-500">{courseName}</p>
        </div>
      </div>

      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
        Set the <strong>New Progress Code</strong> for one or more learners below. Use <strong>Fill Down</strong> (▼ button) in any cell to flood-fill the same value to all rows below. Click <strong>Submit</strong> when done.
      </div>

      {/* Grid */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Enrolled Learners</h2>
          <span className="text-xs text-gray-400">{enrolled.length} learner{enrolled.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Surname</TableHead>
                <TableHead className="whitespace-nowrap">Forename</TableHead>
                <TableHead className="whitespace-nowrap">Current Progress Code</TableHead>
                <TableHead className="whitespace-nowrap min-w-[220px]">New Progress Code</TableHead>
                <TableHead className="whitespace-nowrap min-w-[180px]">Progress Date</TableHead>
                <TableHead className="whitespace-nowrap min-w-[180px]">Comments</TableHead>
                <TableHead className="whitespace-nowrap min-w-[180px]">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrolled.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    No enrolled learners found
                  </TableCell>
                </TableRow>
              ) : (
                enrolled.map((student, idx) => {
                  const row = getRow(student.id);
                  return (
                    <TableRow key={student.id} className={row.newProgressCode ? "bg-blue-50/40" : ""}>
                      <TableCell>
                        <button
                          className="font-medium text-blue-600 hover:underline text-sm"
                          onClick={() => setLocation(`/students/${student.id}`)}
                        >
                          {student.surname}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm">{student.forename}</TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-sm">A</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Select
                            value={row.newProgressCode || "none"}
                            onValueChange={(v) => setRow(student.id, { newProgressCode: v === "none" ? "" : v })}
                          >
                            <SelectTrigger className="h-8 text-sm flex-1">
                              <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— No change —</SelectItem>
                              {PROGRESS_CODES.map(({ code, label }) => (
                                <SelectItem key={code} value={code}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {row.newProgressCode && (
                            <button
                              title="Fill Down"
                              onClick={() => fillDown("newProgressCode", idx, row.newProgressCode)}
                              className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500 shrink-0"
                            >
                              <ChevronsDown size={14} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            value={row.progressDate}
                            onChange={(e) => setRow(student.id, { progressDate: e.target.value })}
                            className="h-8 text-sm flex-1"
                          />
                          <button
                            title="Fill Down"
                            onClick={() => fillDown("progressDate", idx, row.progressDate)}
                            className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500 shrink-0"
                          >
                            <ChevronsDown size={14} />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            value={row.comments}
                            onChange={(e) => setRow(student.id, { comments: e.target.value })}
                            placeholder="Comments…"
                            className="h-8 text-sm flex-1"
                          />
                          {row.comments && (
                            <button
                              title="Fill Down"
                              onClick={() => fillDown("comments", idx, row.comments)}
                              className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500 shrink-0"
                            >
                              <ChevronsDown size={14} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            value={row.reason}
                            onChange={(e) => setRow(student.id, { reason: e.target.value })}
                            placeholder="Reason…"
                            className="h-8 text-sm flex-1"
                          />
                          {row.reason && (
                            <button
                              title="Fill Down"
                              onClick={() => fillDown("reason", idx, row.reason)}
                              className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-500 shrink-0"
                            >
                              <ChevronsDown size={14} />
                            </button>
                          )}
                        </div>
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
          onClick={openConfirmation}
          disabled={dirtyRows.length === 0 || submitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Submit ({dirtyRows.length} progression{dirtyRows.length !== 1 ? "s" : ""})
        </Button>
      </div>

      {submitError && !showConfirm && (
        <div role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Pending grid */}
      {pending.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Pending Enrolment Progressions</h2>
            <span className="text-xs text-gray-400">{pending.length} submission{pending.length !== 1 ? "s" : ""}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Learner</TableHead>
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
              {pending.map((p) => {
                const s = allStudents.find((s) => s.id === p.studentId);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">
                      {s ? `${s.surname}, ${s.forename}` : p.submittedBy ?? "—"}
                    </TableCell>
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
                      {formatDateOnly(p.progressDate)}
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
                          onClick={async () => { await deleteProg({ id: p.id }); refetch(); }}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Fill Down message */}
      <Dialog open={!!fillMsg} onOpenChange={() => setFillMsg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Fill Down</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">{fillMsg}</p>
          <DialogFooter><Button onClick={() => setFillMsg(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm submit */}
      <Dialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (!submittingRef.current) setShowConfirm(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit eProgressions?</DialogTitle></DialogHeader>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              Submitting <strong>{dirtyRows.length}</strong> progression{dirtyRows.length !== 1 ? "s" : ""} for{" "}
              <strong>{courseName}</strong>.
            </p>
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              These will not update the source tables directly. Submissions will appear on the Agent Progressions tab for authorisation.
            </p>
            {submitError && (
              <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-red-700">
                {submitError}
              </p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success */}
      <Dialog
        open={completedRecords.length > 0}
        onOpenChange={(open) => {
          if (!open) setCompletedRecords([]);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle size={20} /> eProgressions Submitted
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {completedRecords.length} eProgression{completedRecords.length === 1 ? " has" : "s have"} been saved and
            {completedRecords.length === 1 ? " is" : " are"} now awaiting authorisation.
          </p>
          <DialogFooter><Button onClick={() => setCompletedRecords([])}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
