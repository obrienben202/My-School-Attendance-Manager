import { useState } from "react";
import { useLocation } from "wouter";
import { useListStudents, useListConciergeApplications, useCreateConciergeApplication } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, UserPlus, ChevronRight } from "lucide-react";

export default function ConciergeApplicants() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [forename, setForename] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [courseId, setCourseId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: students = [] } = useListStudents({} as any);
  const { data: applications = [], refetch } = useListConciergeApplications({} as any);
  const { mutateAsync: createApp } = useCreateConciergeApplication();

  const filtered = search.trim()
    ? students.filter(
        (s) =>
          `${s.forename} ${s.surname}`.toLowerCase().includes(search.toLowerCase())
      )
    : students;

  const getApplications = (studentId: number) =>
    applications.filter((a) => a.studentId === studentId);

  const handleInvite = async () => {
    if (!forename || !surname || !email) return;
    setSaving(true);
    try {
      await createApp({
        data: {
          forename,
          surname,
          email,
          courseId: courseId ? Number(courseId) : null,
          status: "Applied",
        },
      });
      await refetch();
      setShowInvite(false);
      setForename("");
      setSurname("");
      setEmail("");
      setCourseId("");
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      Applied: "bg-blue-100 text-blue-700",
      "Under Review": "bg-yellow-100 text-yellow-700",
      "Interview Scheduled": "bg-purple-100 text-purple-700",
      "Offer Made": "bg-indigo-100 text-indigo-700",
      Accepted: "bg-green-100 text-green-700",
      Rejected: "bg-red-100 text-red-700",
      Withdrawn: "bg-gray-100 text-gray-700",
    };
    return map[status] ?? "bg-gray-100 text-gray-700";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/concierge")}>
          <ArrowLeft size={16} className="mr-1" /> Concierge
        </Button>
        <h1 className="text-xl font-bold text-gray-900">Applicants</h1>
      </div>

      {/* Search bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Search for a learner</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search by name or email address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowInvite(true)}
          >
            <UserPlus size={16} />
            Invite new applicant
          </Button>
        </div>
      </div>

      {/* Invited applicants (no student id) */}
      {(() => {
        const invited = applications.filter((a) => !a.studentId);
        if (invited.length === 0) return null;
        return (
          <div className="bg-white border border-gray-200 rounded-lg mb-4">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Invited Applicants</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invited.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setLocation(`/concierge/applications/${a.id}`)}
                  >
                    <TableCell className="font-medium">
                      {a.forename} {a.surname}
                    </TableCell>
                    <TableCell className="text-gray-500">{a.email}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}>
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(a.createdAt).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell>
                      <ChevronRight size={16} className="text-gray-400" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })()}

      {/* Existing learners */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Learner Accounts {search ? `— results for "${search}"` : ""}
          </h2>
          <span className="text-xs text-gray-400">{filtered.length} learner{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Name</TableHead>
              <TableHead>Date of Birth</TableHead>
              <TableHead>Year Group</TableHead>
              <TableHead>Applications</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                  No learners found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const apps = getApplications(s.id);
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setLocation(`/concierge/applicants/${s.id}`)}
                  >
                    <TableCell className="font-medium">
                      {s.forename} {s.surname}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {s.dateOfBirth ?? "—"}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {(s as any).yearGroup ?? "—"}
                    </TableCell>
                    <TableCell>
                      {apps.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {apps.slice(0, 3).map((a) => (
                            <span
                              key={a.id}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}
                            >
                              {a.status}
                            </span>
                          ))}
                          {apps.length > 3 && (
                            <span className="text-xs text-gray-400">+{apps.length - 3} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No applications</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight size={16} className="text-gray-400" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite New Applicant</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600 mb-4">
            The applicant will receive an email to create a learner account. Ensure you have searched for an existing account first to avoid duplicates.
          </div>
          <div className="space-y-3">
            <div>
              <Label>Forename <span className="text-red-500">*</span></Label>
              <Input value={forename} onChange={(e) => setForename(e.target.value)} placeholder="First name" />
            </div>
            <div>
              <Label>Surname <span className="text-red-500">*</span></Label>
              <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Last name" />
            </div>
            <div>
              <Label>Email Address <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="applicant@example.com"
              />
              <p className="text-xs text-gray-400 mt-1">Must be unique — not already used by another learner account.</p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button
              onClick={handleInvite}
              disabled={!forename || !surname || !email || saving}
            >
              {saving ? "Sending…" : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
