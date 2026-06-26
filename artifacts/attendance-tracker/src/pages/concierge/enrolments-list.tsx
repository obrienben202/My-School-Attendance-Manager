import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, Search, Plus, ChevronRight } from "lucide-react";

const MOCK_ENROLMENTS = [
  {
    id: 1,
    learner: "Emma Davies",
    courseCode: "AMAT01",
    course: "A-Level Mathematics",
    startDate: "2026-09-01",
    endDate: "2027-06-30",
    progressCode: "A",
    status: "Enrolled",
  },
  {
    id: 2,
    learner: "James Wilson",
    courseCode: "ENG-FS",
    course: "English Functional Skills Level 2",
    startDate: "2026-09-01",
    endDate: "2027-05-31",
    progressCode: "A",
    status: "Enrolled",
  },
  {
    id: 3,
    learner: "Aisha Patel",
    courseCode: "BUS-A",
    course: "A-Level Business Studies",
    startDate: "2026-09-01",
    endDate: "2027-06-30",
    progressCode: "B",
    status: "Enrolled",
  },
];

const statusColor = (s: string) => {
  const m: Record<string, string> = {
    Enrolled: "bg-green-100 text-green-700",
    Withdrawn: "bg-gray-100 text-gray-700",
    Completed: "bg-blue-100 text-blue-700",
    Suspended: "bg-red-100 text-red-700",
  };
  return m[s] ?? "bg-gray-100 text-gray-700";
};

export default function EnrolmentsList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = MOCK_ENROLMENTS.filter((e) => {
    const matchSearch =
      !search ||
      e.learner.toLowerCase().includes(search.toLowerCase()) ||
      e.courseCode.toLowerCase().includes(search.toLowerCase()) ||
      e.course.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/concierge")}>
          <ArrowLeft size={16} className="mr-1" /> Concierge
        </Button>
        <h1 className="text-xl font-bold text-gray-900">Enrolments</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search by learner or course…"
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
              <SelectItem value="Enrolled">Enrolled</SelectItem>
              <SelectItem value="Withdrawn">Withdrawn</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={() => setLocation("/concierge/enrolments/new")}>
            <Plus size={16} /> New Enrolment
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Enrolments</h2>
          <span className="text-xs text-gray-400">{filtered.length} enrolment{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Learner</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Progress Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                  No enrolments found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setLocation(`/concierge/enrolments/${e.id}`)}
                >
                  <TableCell className="font-medium">{e.learner}</TableCell>
                  <TableCell>
                    <div className="text-sm">{e.course}</div>
                    <div className="text-xs text-gray-400 font-mono">{e.courseCode}</div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(e.startDate).toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(e.endDate).toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold text-sm">{e.progressCode}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(e.status)}`}>
                      {e.status}
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
    </div>
  );
}
