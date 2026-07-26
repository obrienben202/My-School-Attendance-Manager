import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@workspace/replit-auth-web";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Users, BookOpen, Filter, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DeptSlot = {
  slotId: number;
  day: string | null;
  startTime: string;
  endTime: string;
  room: string | null;
  weekPattern: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  staffName: string | null;
  yearGroup: string | null;
  headOfDepartment: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri",
};

// Distinct colours for up to 12 staff members
const STAFF_COLOURS = [
  "bg-teal-50 border-teal-300 text-teal-800",
  "bg-indigo-50 border-indigo-300 text-indigo-800",
  "bg-amber-50 border-amber-300 text-amber-800",
  "bg-rose-50 border-rose-300 text-rose-800",
  "bg-violet-50 border-violet-300 text-violet-800",
  "bg-emerald-50 border-emerald-300 text-emerald-800",
  "bg-cyan-50 border-cyan-300 text-cyan-800",
  "bg-orange-50 border-orange-300 text-orange-800",
  "bg-pink-50 border-pink-300 text-pink-800",
  "bg-lime-50 border-lime-300 text-lime-800",
  "bg-sky-50 border-sky-300 text-sky-800",
  "bg-fuchsia-50 border-fuchsia-300 text-fuchsia-800",
];

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HodTimetable() {
  const [, navigate] = useLocation();
  const role = useRole();
  const { user } = useAuth();
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterWeek, setFilterWeek] = useState<string>("all");

  const { data: slots = [], isLoading, error } = useQuery<DeptSlot[]>({
    queryKey: ["hod-department-timetable"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/hod/department-timetable`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Unique staff members (for the filter and colour map)
  const allStaff = useMemo(() => {
    const names = [...new Set(slots.map(s => s.staffName ?? "Unknown"))].sort();
    return names;
  }, [slots]);

  const staffColourMap = useMemo(() => {
    const map: Record<string, string> = {};
    allStaff.forEach((name, i) => {
      map[name] = STAFF_COLOURS[i % STAFF_COLOURS.length];
    });
    return map;
  }, [allStaff]);

  // Filtered slots
  const filtered = useMemo(() => slots.filter(s => {
    if (filterStaff !== "all" && (s.staffName ?? "Unknown") !== filterStaff) return false;
    if (filterWeek !== "all" && s.weekPattern !== filterWeek) return false;
    return true;
  }), [slots, filterStaff, filterWeek]);

  // Group by day
  const byDay = useMemo(() => {
    const map: Record<string, DeptSlot[]> = {};
    DAYS.forEach(d => { map[d] = []; });
    filtered.forEach(s => {
      const day = s.day ?? "Monday";
      if (map[day]) map[day].push(s);
    });
    // Sort each day by start time
    DAYS.forEach(d => {
      map[d].sort((a, b) => toMins(a.startTime) - toMins(b.startTime));
    });
    return map;
  }, [filtered]);

  const totalSlots = filtered.length;
  const uniqueCourses = new Set(filtered.map(s => s.courseId)).size;
  const uniqueStaff = new Set(filtered.map(s => s.staffName).filter(Boolean)).size;

  const dept = (user as { department?: string } | null)?.department;
  const pageTitle = role === "admin"
    ? "All Department Timetables"
    : dept
      ? `${dept} — Department Timetable`
      : "Department Timetable";

  if (role !== "admin" && role !== "hod") {
    return <div className="p-12 text-center text-muted-foreground">Access restricted to Admin and Head of Department.</div>;
  }

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Clock size={17} className="text-teal-700" />
              <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
            </div>
            <p className="text-sm text-slate-500">
              Weekly overview of all scheduled lessons across your department's staff.
            </p>
          </div>
          {/* Stats */}
          <div className="flex gap-4 text-center">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
              <p className="text-lg font-bold text-teal-700">{totalSlots}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Slots</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
              <p className="text-lg font-bold text-slate-700">{uniqueCourses}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Courses</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
              <p className="text-lg font-bold text-slate-700">{uniqueStaff}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Staff</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-3 flex-wrap">
        <Filter size={13} className="text-slate-400 shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Staff:</label>
          <select
            value={filterStaff}
            onChange={e => setFilterStaff(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
          >
            <option value="all">All staff</option>
            {allStaff.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Week pattern:</label>
          <select
            value={filterWeek}
            onChange={e => setFilterWeek(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
          >
            <option value="all">All</option>
            <option value="Every week">Every week</option>
            <option value="Week A only">Week A only</option>
            <option value="Week B only">Week B only</option>
          </select>
        </div>
      </div>

      {/* Staff key */}
      {allStaff.length > 0 && (
        <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-2 flex-wrap">
          <Users size={12} className="text-slate-400 shrink-0" />
          {allStaff.map(name => (
            <button
              key={name}
              onClick={() => setFilterStaff(filterStaff === name ? "all" : name)}
              className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border font-medium transition-opacity ${staffColourMap[name]} ${filterStaff !== "all" && filterStaff !== name ? "opacity-30" : "opacity-100"}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Timetable grid */}
      <div className="flex-1 p-6 overflow-auto">
        {isLoading ? (
          <div className="space-y-3">
            {DAYS.map(d => <Skeleton key={d} className="h-24 w-full" />)}
          </div>
        ) : error ? (
          <div className="py-16 text-center text-red-500 text-sm">Failed to load timetable data.</div>
        ) : totalSlots === 0 && slots.length === 0 ? (
          <div className="py-24 text-center">
            <BookOpen size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">No timetable slots set yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Head to any course's <strong>Timetable Slots</strong> tab to add lessons.
            </p>
          </div>
        ) : totalSlots === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">No slots match the current filters.</div>
        ) : (
          <div className="grid grid-cols-5 gap-3 min-w-[700px]">
            {/* Day headers */}
            {DAYS.map(day => (
              <div key={day} className="text-center">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider bg-white border border-slate-200 rounded-lg py-2 mb-2 shadow-sm">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{DAY_SHORT[day]}</span>
                  <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                    ({byDay[day].length})
                  </span>
                </div>

                {/* Slots for this day */}
                <div className="space-y-2">
                  {byDay[day].length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-lg py-6 text-xs text-slate-300 text-center">
                      No lessons
                    </div>
                  ) : (
                    byDay[day].map(slot => {
                      const staffKey = slot.staffName ?? "Unknown";
                      const colour = staffColourMap[staffKey] ?? STAFF_COLOURS[0];
                      return (
                        <button
                          key={slot.slotId}
                          onClick={() => navigate(`/courses/${slot.courseId}`)}
                          className={`w-full text-left border rounded-lg p-2.5 transition-all hover:shadow-md hover:-translate-y-0.5 ${colour}`}
                        >
                          <p className="text-[11px] font-bold leading-tight truncate">{slot.courseName}</p>
                          <p className="text-[10px] opacity-70 mt-0.5">{slot.courseCode}</p>
                          <div className="mt-1.5 space-y-0.5">
                            <div className="flex items-center gap-1 text-[10px] opacity-80">
                              <Clock size={9} />
                              <span>{slot.startTime}–{slot.endTime}</span>
                            </div>
                            {slot.room && (
                              <div className="text-[10px] opacity-70">
                                Room: <span className="font-medium">{slot.room}</span>
                              </div>
                            )}
                            {slot.staffName && (
                              <div className="text-[10px] font-semibold opacity-90 truncate">{slot.staffName}</div>
                            )}
                            {slot.weekPattern !== "Every week" && (
                              <div className="text-[9px] opacity-60 italic">{slot.weekPattern}</div>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center gap-0.5 text-[9px] opacity-50">
                            <ChevronRight size={9} /> View course
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
