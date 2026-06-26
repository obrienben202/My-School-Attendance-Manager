import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Search, ChevronRight, Calendar, Users } from "lucide-react";

type InterviewStatus = "Scheduled" | "Completed" | "Cancelled";

interface Interview {
  id: number;
  eventName: string;
  date: string;
  time: string;
  location: string;
  interviewer: string;
  allocated: number;
  capacity: number;
  status: InterviewStatus;
  learners: { name: string; notes: string; status: string }[];
}

const MOCK_INTERVIEWS: Interview[] = [
  {
    id: 1,
    eventName: "A-Level Maths Interview Session",
    date: "2026-07-10",
    time: "09:00",
    location: "Room 101",
    interviewer: "Dr. Sarah Johnson",
    allocated: 8,
    capacity: 10,
    status: "Scheduled",
    learners: [
      { name: "James Wilson", notes: "", status: "Scheduled" },
      { name: "Emma Davies", notes: "Strong maths background", status: "Completed" },
      { name: "Oliver Brown", notes: "", status: "Scheduled" },
    ],
  },
  {
    id: 2,
    eventName: "English Language Skills Assessment",
    date: "2026-07-12",
    time: "13:30",
    location: "Hall B",
    interviewer: "Ms. Rachel Green",
    allocated: 5,
    capacity: 8,
    status: "Scheduled",
    learners: [
      { name: "Aisha Patel", notes: "Overseas applicant", status: "Scheduled" },
      { name: "Lucas Martin", notes: "", status: "Scheduled" },
    ],
  },
  {
    id: 3,
    eventName: "Vocational Skills Day",
    date: "2026-06-20",
    time: "10:00",
    location: "Workshop Area",
    interviewer: "Mr. Tom Baker",
    allocated: 12,
    capacity: 12,
    status: "Completed",
    learners: [
      { name: "Sophie Taylor", notes: "Excellent practical skills", status: "Completed" },
      { name: "Liam Harris", notes: "Recommend offer", status: "Completed" },
    ],
  },
];

const statusColor: Record<InterviewStatus, string> = {
  Scheduled: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-700",
};

const learnerStatusColor: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  "No Show": "bg-red-100 text-red-700",
};

export default function ConciergeInterviews() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Interview | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>(MOCK_INTERVIEWS);
  const [editingLearner, setEditingLearner] = useState<number | null>(null);
  const [learnerNotes, setLearnerNotes] = useState("");
  const [learnerStatus, setLearnerStatus] = useState("Scheduled");

  const filtered = search
    ? interviews.filter(
        (i) =>
          i.eventName.toLowerCase().includes(search.toLowerCase()) ||
          i.interviewer.toLowerCase().includes(search.toLowerCase()) ||
          i.location.toLowerCase().includes(search.toLowerCase())
      )
    : interviews;

  const openInterview = (interview: Interview) => {
    setSelected(interview);
    setEditingLearner(null);
  };

  const startEditLearner = (idx: number) => {
    if (!selected) return;
    setEditingLearner(idx);
    setLearnerNotes(selected.learners[idx].notes);
    setLearnerStatus(selected.learners[idx].status);
  };

  const saveLearner = () => {
    if (!selected || editingLearner === null) return;
    const updated: Interview = {
      ...selected,
      learners: selected.learners.map((l, i) =>
        i === editingLearner ? { ...l, notes: learnerNotes, status: learnerStatus } : l
      ),
    };
    setSelected(updated);
    setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingLearner(null);
  };

  const updateInterviewStatus = (status: InterviewStatus) => {
    if (!selected) return;
    const updated = { ...selected, status };
    setSelected(updated);
    setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/concierge")}>
          <ArrowLeft size={16} className="mr-1" /> Concierge
        </Button>
        <h1 className="text-xl font-bold text-gray-900">Interviews</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search by event name, interviewer or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Interview Events</h2>
          <span className="text-xs text-gray-400">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Event Name</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Interviewer</TableHead>
              <TableHead>Allocated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                  No interviews found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((interview) => (
                <TableRow
                  key={interview.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => openInterview(interview)}
                >
                  <TableCell className="font-medium">{interview.eventName}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(interview.date).toLocaleDateString("en-GB")} {interview.time}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{interview.location}</TableCell>
                  <TableCell className="text-sm text-gray-600">{interview.interviewer}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <Users size={13} className="text-gray-400" />
                      {interview.allocated}/{interview.capacity}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[interview.status]}`}>
                      {interview.status}
                    </span>
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

      {/* Interview detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.eventName}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-xs text-gray-400 mb-1">Date & Time</div>
                  <div className="font-medium">
                    {new Date(selected.date).toLocaleDateString("en-GB")} {selected.time}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-xs text-gray-400 mb-1">Location</div>
                  <div className="font-medium">{selected.location}</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-xs text-gray-400 mb-1">Interviewer</div>
                  <div className="font-medium">{selected.interviewer}</div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Learners ({selected.allocated}/{selected.capacity})
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Interview Status:</span>
                  <Select
                    value={selected.status}
                    onValueChange={(v) => updateInterviewStatus(v as InterviewStatus)}
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selected.learners.map((learner, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-md">
                    {editingLearner === idx ? (
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{learner.name}</span>
                          <Select value={learnerStatus} onValueChange={setLearnerStatus}>
                            <SelectTrigger className="h-7 text-xs w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Scheduled">Scheduled</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="No Show">No Show</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Interview notes…"
                          value={learnerNotes}
                          onChange={(e) => setLearnerNotes(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEditingLearner(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={saveLearner}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-start justify-between p-3 cursor-pointer hover:bg-gray-50"
                        onClick={() => startEditLearner(idx)}
                      >
                        <div>
                          <div className="font-medium text-sm">{learner.name}</div>
                          {learner.notes && (
                            <div className="text-xs text-gray-500 mt-0.5">{learner.notes}</div>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            learnerStatusColor[learner.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {learner.status}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
