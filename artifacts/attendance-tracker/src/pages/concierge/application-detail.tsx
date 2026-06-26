import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetConciergeApplication,
  useUpdateConciergeApplication,
  useListStudents,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, Clock, AlertCircle } from "lucide-react";

const STATUSES = ["Applied", "Under Review", "Interview Scheduled", "Offer Made", "Accepted", "Rejected", "Withdrawn"];

const TABS = [
  "Application Details",
  "Interview Details",
  "Qualifications",
  "Requirements",
  "Offers",
] as const;

type Tab = (typeof TABS)[number];

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

const progressSteps = ["Applied", "Under Review", "Interview Scheduled", "Offer Made", "Accepted"];

export default function ApplicationDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [activeTab, setActiveTab] = useState<Tab>("Application Details");
  const [showConvertModal, setShowConvertModal] = useState(false);

  const { data: app, refetch } = useGetConciergeApplication(id, { query: { enabled: !!id } as any });
  const { data: students = [] } = useListStudents({} as any);
  const { mutateAsync: updateApp } = useUpdateConciergeApplication();

  if (!app) {
    return (
      <div className="p-6 text-center text-gray-400">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
        Loading…
      </div>
    );
  }

  const student = students.find((s) => s.id === app.studentId);
  const displayName =
    student
      ? `${student.forename} ${student.surname}`
      : `${app.forename ?? ""} ${app.surname ?? ""}`.trim() || "Unknown";

  const stepIdx = progressSteps.indexOf(app.status);

  const save = async (patch: Partial<typeof app>) => {
    await updateApp({ id, data: patch as any });
    await refetch();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/concierge/applications")}>
          <ArrowLeft size={16} className="mr-1" /> Applications
        </Button>
        <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(app.status)}`}>
          {app.status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center">
          {progressSteps.map((step, i) => {
            const done = stepIdx > i;
            const active = stepIdx === i;
            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      done
                        ? "bg-green-500 border-green-500 text-white"
                        : active
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-white border-gray-300 text-gray-400"
                    }`}
                  >
                    {done ? <CheckCircle size={14} /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center max-w-20 leading-tight ${active ? "text-blue-600 font-medium" : done ? "text-green-600" : "text-gray-400"}`}>
                    {step}
                  </span>
                </div>
                {i < progressSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? "bg-green-400" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status & action */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-600">Status:</Label>
          <Select
            value={app.status}
            onValueChange={(v) => save({ status: v })}
          >
            <SelectTrigger className="w-48 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {app.status === "Accepted" && (
          <Button
            onClick={() => setShowConvertModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white text-sm"
          >
            Convert to Enrolment
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "Application Details" && (
            <ApplicationDetailsTab app={app} student={student} onSave={save} />
          )}
          {activeTab === "Interview Details" && (
            <InterviewDetailsTab app={app} onSave={save} />
          )}
          {activeTab === "Qualifications" && (
            <QualificationsTab app={app} onSave={save} />
          )}
          {activeTab === "Requirements" && (
            <RequirementsTab app={app} onSave={save} />
          )}
          {activeTab === "Offers" && (
            <OffersTab app={app} onSave={save} />
          )}
        </div>
      </div>

      {/* Convert to enrolment modal */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to Enrolment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            You are about to convert the application for <strong>{displayName}</strong> into an enrolment. You will be
            taken to the enrolment form to complete personal details, equal opportunities information, and payments.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowConvertModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setShowConvertModal(false);
                setLocation(`/concierge/enrolments/new?applicationId=${id}`);
              }}
            >
              Begin Enrolment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationDetailsTab({ app, student, onSave }: {
  app: any;
  student: any;
  onSave: (p: any) => Promise<void>;
}) {
  const [notes, setNotes] = useState(app.progressNotes ?? "");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <InfoRow label="Forename" value={student?.forename ?? app.forename ?? "—"} />
        <InfoRow label="Surname" value={student?.surname ?? app.surname ?? "—"} />
        <InfoRow label="Email" value={app.email ?? "—"} />
        <InfoRow label="Date of Birth" value={student?.dateOfBirth ?? "—"} />
        <InfoRow label="Gender" value={(student as any)?.gender ?? "—"} />
        <InfoRow label="Applied" value={new Date(app.createdAt).toLocaleDateString("en-GB")} />
      </div>
      <div>
        <Label>Progress Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1"
          placeholder="Add notes about this application…"
        />
        <Button
          size="sm"
          className="mt-2"
          onClick={() => onSave({ progressNotes: notes })}
        >
          Save Notes
        </Button>
      </div>
    </div>
  );
}

function InterviewDetailsTab({ app, onSave }: { app: any; onSave: (p: any) => Promise<void> }) {
  const [date, setDate] = useState(app.interviewDate ?? "");
  const [status, setStatus] = useState(app.interviewStatus ?? "Scheduled");
  const [notes, setNotes] = useState(app.interviewNotes ?? "");

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label>Interview Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label>Interview Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Scheduled">Scheduled</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Interview Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mt-1"
          placeholder="Add notes from the interview, recommendations, etc."
        />
      </div>
      <Button
        onClick={() =>
          onSave({ interviewDate: date || null, interviewStatus: status, interviewNotes: notes || null })
        }
      >
        Save Interview Details
      </Button>
    </div>
  );
}

function QualificationsTab({ app, onSave }: { app: any; onSave: (p: any) => Promise<void> }) {
  const [quals, setQuals] = useState(app.qualifications ?? "");

  let parsed: { subject: string; grade: string; year: string; predicted: boolean }[] = [];
  try { parsed = JSON.parse(quals); } catch { parsed = []; }

  const [rows, setRows] = useState(
    parsed.length > 0
      ? parsed
      : [{ subject: "", grade: "", year: "", predicted: false }]
  );

  const save = async () => {
    const json = JSON.stringify(rows.filter((r) => r.subject));
    await onSave({ qualifications: json });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Qualifications</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRows([...rows, { subject: "", grade: "", year: "", predicted: false }])}
        >
          + Add Qualification
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 text-xs font-medium text-gray-500">Subject</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500">Grade</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500">Year Achieved</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500">Predicted</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-2 py-1">
                  <Input value={row.subject} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, subject: e.target.value } : r))} className="h-7 text-sm" />
                </td>
                <td className="px-2 py-1">
                  <Input value={row.grade} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, grade: e.target.value } : r))} className="h-7 text-sm w-20" />
                </td>
                <td className="px-2 py-1">
                  <Input value={row.year} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, year: e.target.value } : r))} className="h-7 text-sm w-24" placeholder="YYYY" />
                </td>
                <td className="px-2 py-1 text-center">
                  <input type="checkbox" checked={row.predicted} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, predicted: e.target.checked } : r))} />
                </td>
                <td className="px-2 py-1">
                  <Button size="sm" variant="ghost" className="h-7 text-red-500 hover:text-red-700" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" onClick={save}>Save Qualifications</Button>
    </div>
  );
}

function RequirementsTab({ app, onSave }: { app: any; onSave: (p: any) => Promise<void> }) {
  const [reqs, setReqs] = useState(app.requirements ?? "");
  let parsed: { description: string; status: string }[] = [];
  try { parsed = JSON.parse(reqs); } catch { parsed = []; }

  const defaultReqs = [
    { description: "GCSE Maths Grade 4+", status: "Pending" },
    { description: "GCSE English Grade 4+", status: "Pending" },
    { description: "Reference Letter", status: "Pending" },
  ];
  const [rows, setRows] = useState(parsed.length > 0 ? parsed : defaultReqs);

  const save = async () => {
    await onSave({ requirements: JSON.stringify(rows) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Course Requirements</h3>
        <Button size="sm" variant="outline" onClick={() => setRows([...rows, { description: "", status: "Pending" }])}>
          + Add Requirement
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((req, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-md">
            <div className="flex-1">
              <Input
                value={req.description}
                onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, description: e.target.value } : r))}
                className="h-7 text-sm"
                placeholder="Requirement description"
              />
            </div>
            <Select value={req.status} onValueChange={(v) => setRows(rows.map((r, j) => j === i ? { ...r, status: v } : r))}>
              <SelectTrigger className="w-44 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Requirements Met">Requirements Met</SelectItem>
                <SelectItem value="Waived">Waived</SelectItem>
              </SelectContent>
            </Select>
            {req.status === "Requirements Met" && <CheckCircle size={16} className="text-green-500 shrink-0" />}
            {req.status === "Pending" && <Clock size={16} className="text-gray-400 shrink-0" />}
            <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</Button>
          </div>
        ))}
      </div>
      <Button size="sm" onClick={save}>Save Requirements</Button>
    </div>
  );
}

function OffersTab({ app, onSave }: { app: any; onSave: (p: any) => Promise<void> }) {
  const [offerType, setOfferType] = useState(app.offerType ?? "");
  const [offerStatus, setOfferStatus] = useState(app.offerStatus ?? "Pending");

  return (
    <div className="space-y-4 max-w-md">
      {!app.offerType && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          No offer has been made yet. Complete the requirements and interview stages first.
        </div>
      )}
      <div>
        <Label>Offer Type</Label>
        <Select value={offerType || "none"} onValueChange={(v) => setOfferType(v === "none" ? "" : v)}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="No offer yet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No offer</SelectItem>
            <SelectItem value="Conditional">Conditional</SelectItem>
            <SelectItem value="Unconditional">Unconditional</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {offerType && (
        <div>
          <Label>Offer Status</Label>
          <Select value={offerStatus} onValueChange={setOfferStatus}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Accepted">Accepted by applicant</SelectItem>
              <SelectItem value="Rejected">Rejected by applicant</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <Button
        onClick={() =>
          onSave({
            offerType: offerType || null,
            offerStatus: offerType ? offerStatus : null,
            status: offerStatus === "Accepted" ? "Accepted" : app.status,
          })
        }
      >
        Save Offer
      </Button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm text-gray-800 font-medium">{value}</div>
    </div>
  );
}
