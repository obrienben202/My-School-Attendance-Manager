import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useListCourses } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, ChevronUp, ChevronDown, PenSquare, Edit } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const START_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

type RegisterStatus = "Open" | "Marked" | "Submitted";
type SortField = "description" | "date" | "day" | "time" | "room" | "status";
type SortDir = "asc" | "desc";

const STATUS_STYLES: Record<RegisterStatus, string> = {
  Open:      "bg-amber-100 text-amber-700 border-amber-200",
  Marked:    "bg-blue-100 text-blue-700 border-blue-200",
  Submitted: "bg-green-100 text-green-700 border-green-200",
};

export default function ERegisters() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: courses = [], isLoading } = useListCourses();

  // Generate a register session per course (deterministic from course ID)
  const registers = useMemo(() => {
    const today = new Date();
    return courses.map((c) => {
      const dayIdx = c.id % DAYS.length;
      const timeIdx = c.id % START_TIMES.length;
      const startTime = START_TIMES[timeIdx];
      const [startH] = startTime.split(":").map(Number);
      const endTime = `${String(startH + 1).padStart(2, "0")}:00`;
      // Assign a date: today or recent past to simulate due registers
      const offset = c.id % 7;
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      const dateStr = d.toISOString().split("T")[0];
      // Pseudo-status based on offset
      const status: RegisterStatus = offset === 0 ? "Open" : offset <= 2 ? "Marked" : "Submitted";

      return {
        id: c.id,
        description: `${c.code} — ${c.name}`,
        courseCode: c.code,
        courseName: c.name,
        date: dateStr,
        day: DAYS[dayIdx],
        startTime,
        endTime,
        room: c.room ?? `Rm ${(c.id % 20) + 1}`,
        staff: c.staffName ?? "TBC",
        status,
        enrolled: c.enrolledCount,
      };
    });
  }, [courses]);

  const filtered = useMemo(() => {
    let list = registers;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.room.toLowerCase().includes(q) ||
          r.staff.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    list = [...list].sort((a, b) => {
      let av: string = "";
      let bv: string = "";
      if (sort === "description") { av = a.description; bv = b.description; }
      else if (sort === "date") { av = a.date; bv = b.date; }
      else if (sort === "day") { av = a.day; bv = b.day; }
      else if (sort === "time") { av = a.startTime; bv = b.startTime; }
      else if (sort === "room") { av = a.room; bv = b.room; }
      else if (sort === "status") { av = a.status; bv = b.status; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [registers, filter, statusFilter, sort, sortDir]);

  function toggleSort(field: SortField) {
    if (sort === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  }

  const open = registers.filter((r) => r.status === "Open").length;
  const marked = registers.filter((r) => r.status === "Marked").length;
  const submitted = registers.filter((r) => r.status === "Submitted").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">eRegisters</h1>
        <p className="text-gray-500 mt-1 text-sm">
          eRegisters assigned to you. Click <strong>Mark Register</strong> to open and mark attendance, or <strong>Edit Attendance</strong> to correct a submitted register.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: "Open (Due)", count: open, style: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "Marked (Saved)", count: marked, style: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Submitted (Final)", count: submitted, style: "bg-green-50 border-green-200 text-green-700" },
        ].map(({ label, count, style }) => (
          <div key={label} className={`border rounded-lg p-4 flex items-center gap-3 ${style}`}>
            <ClipboardList size={20} />
            <div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex gap-2 flex-wrap items-center">
        <Input
          className="flex-1 min-w-[200px] h-8 text-sm"
          placeholder="Filter by description, room, or staff…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Marked">Marked</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} register{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Registers table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-14 flex flex-col items-center text-gray-400">
            <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No eRegisters found matching your filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {(
                    [
                      { field: "description" as SortField, label: "Register Description" },
                      { field: "date" as SortField, label: "Date" },
                      { field: "day" as SortField, label: "Day" },
                      { field: "time" as SortField, label: "Time" },
                      { field: "room" as SortField, label: "Room" },
                      { field: "status" as SortField, label: "Status" },
                    ] as const
                  ).map(({ field, label }) => (
                    <th
                      key={field}
                      className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs cursor-pointer select-none hover:text-gray-900"
                      onClick={() => toggleSort(field)}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        <SortIcon field={field} />
                      </span>
                    </th>
                  ))}
                  <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Enrolled</th>
                  <th className="text-left font-semibold text-gray-600 px-4 py-2.5 text-xs">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <button
                        className="font-medium text-blue-700 hover:underline text-left text-sm"
                        onClick={() => navigate(`/registers/${r.id}`)}
                      >
                        {r.description}
                      </button>
                      <div className="text-xs text-gray-400">{r.staff}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                      {new Date(r.date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{r.day}</td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap text-xs font-mono">
                      {r.startTime}–{r.endTime}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{r.room}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.enrolled}</td>
                    <td className="px-4 py-2.5">
                      {r.status === "Submitted" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => navigate(`/registers/${r.id}`)}
                        >
                          <Edit size={12} /> Edit Attendance
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-teal-700 hover:bg-teal-800 gap-1"
                          onClick={() => navigate(`/registers/${r.id}`)}
                        >
                          <PenSquare size={12} /> Mark Register
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Only eRegisters with today's date or a date in the past are displayed. Registers are automatically assigned based on your timetable.
      </p>
    </div>
  );
}
