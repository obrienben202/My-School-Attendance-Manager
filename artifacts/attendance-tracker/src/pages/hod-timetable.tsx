import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@workspace/replit-auth-web";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Users, BookOpen, Filter, ChevronRight, CalendarDays, Star } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type UnifiedSlot = {
  type: "course" | "personal";
  slotId: number;
  day: string;
  lessonNumber: number | null;
  startTime: string;
  endTime: string;
  room: string | null;
  weekPattern: string;
  description: string;
  groupLabel: string | null;
  staffName: string | null;   // null = shared HoD entry
  isHodShared: boolean;
  courseId: number | null;
  courseCode: string | null;
  courseName: string | null;
  yearGroup: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri",
};

// Lesson labels for each lesson number
const LESSON_LABEL: Record<number, string> = {
  1: "L1", 2: "L2", 3: "L3", 4: "L4", 5: "L5", 6: "L6",
};

// Colours per staff member
const STAFF_COLOURS = [
  "bg-teal-50 border-teal-300 text-teal-900",
  "bg-indigo-50 border-indigo-300 text-indigo-900",
  "bg-amber-50 border-amber-300 text-amber-900",
  "bg-rose-50 border-rose-300 text-rose-900",
  "bg-violet-50 border-violet-300 text-violet-900",
  "bg-emerald-50 border-emerald-300 text-emerald-900",
  "bg-cyan-50 border-cyan-300 text-cyan-900",
  "bg-orange-50 border-orange-300 text-orange-900",
  "bg-pink-50 border-pink-300 text-pink-900",
  "bg-lime-50 border-lime-300 text-lime-900",
];

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

// ── Slot card ─────────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  colour,
  onClick,
}: {
  slot: UnifiedSlot;
  colour: string;
  onClick?: () => void;
}) {
  const isShared = slot.isHodShared;
  const label = slot.groupLabel ? `${slot.description} ${slot.groupLabel}` : slot.description;
  const lessonTag = slot.lessonNumber ? LESSON_LABEL[slot.lessonNumber] : null;

  if (isShared) {
    return (
      <div className="w-full border rounded-lg p-2.5 bg-amber-50 border-amber-300 text-amber-900">
        <div className="flex items-center gap-1.5 mb-1">
          <Star size={10} className="text-amber-500 shrink-0" />
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">All HoD Staff</span>
        </div>
        <p className="text-[11px] font-bold leading-snug">{label}</p>
        <div className="flex items-center gap-1 text-[10px] opacity-70 mt-1.5">
          <Clock size={9} />
          <span>{slot.startTime}–{slot.endTime}</span>
          {lessonTag && <span className="ml-1 opacity-60">({lessonTag})</span>}
        </div>
      </div>
    );
  }

  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`w-full text-left border rounded-lg p-2.5 transition-all ${colour} ${
        onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""
      }`}
    >
      {/* Lesson / course badge */}
      <div className="flex items-center justify-between mb-0.5">
        {lessonTag && (
          <span className="text-[9px] font-bold opacity-50 uppercase tracking-wider">{lessonTag}</span>
        )}
        {slot.type === "course" && slot.courseCode && (
          <span className="text-[9px] opacity-40">{slot.courseCode}</span>
        )}
      </div>

      <p className="text-[11px] font-bold leading-tight">{label}</p>

      {slot.yearGroup && (
        <p className="text-[10px] opacity-60 mt-0.5">{slot.yearGroup}</p>
      )}

      <div className="mt-1.5 space-y-0.5">
        <div className="flex items-center gap-1 text-[10px] opacity-75">
          <Clock size={9} />
          <span>{slot.startTime}–{slot.endTime}</span>
        </div>
        {slot.room && (
          <div className="text-[10px] opacity-65">Room: <span className="font-medium">{slot.room}</span></div>
        )}
        {slot.staffName && (
          <div className="text-[10px] font-semibold opacity-85 truncate">{slot.staffName}</div>
        )}
        {slot.weekPattern && slot.weekPattern !== "Every week" && (
          <div className="text-[9px] opacity-55 italic">{slot.weekPattern}</div>
        )}
      </div>

      {onClick && (
        <div className="mt-1.5 flex items-center gap-0.5 text-[9px] opacity-40">
          <ChevronRight size={9} /> View course
        </div>
      )}
    </Tag>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HodTimetable() {
  const [, navigate] = useLocation();
  const role = useRole();
  const { user } = useAuth();
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterWeek, setFilterWeek] = useState<string>("all");

  const { data: slots = [], isLoading, error } = useQuery<UnifiedSlot[]>({
    queryKey: ["hod-department-timetable"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/hod/department-timetable`, { credentials: "include", cache: "no-store" });
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 5000,
  });

  // Unique named staff (excluding shared null-staff entries)
  const allStaff = useMemo(() => {
    const names = [...new Set(
      slots.filter(s => !s.isHodShared && s.staffName).map(s => s.staffName as string)
    )].sort();
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
    // Shared HoD entries always pass through
    if (s.isHodShared) return filterStaff === "all";
    if (filterStaff !== "all" && s.staffName !== filterStaff) return false;
    if (filterWeek !== "all" && s.weekPattern !== filterWeek) return false;
    return true;
  }), [slots, filterStaff, filterWeek]);

  // Group by day, then sort by start time within each day
  const byDay = useMemo(() => {
    const map: Record<string, UnifiedSlot[]> = {};
    DAYS.forEach(d => { map[d] = []; });
    filtered.forEach(s => {
      const day = s.day ?? "Monday";
      if (map[day]) map[day].push(s);
    });
    DAYS.forEach(d => {
      map[d].sort((a, b) => toMins(a.startTime) - toMins(b.startTime));
    });
    return map;
  }, [filtered]);

  // Stats
  const totalSlots    = filtered.length;
  const uniqueCourses = new Set(filtered.filter(s => s.courseId).map(s => s.courseId)).size;
  const uniqueStaff   = new Set(filtered.filter(s => s.staffName).map(s => s.staffName)).size;

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

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <CalendarDays size={17} className="text-teal-700" />
              <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
            </div>
            <p className="text-sm text-slate-500">
              Weekly overview of all lessons across department staff. Updates every 5 seconds.
            </p>
          </div>
          <div className="flex gap-3 text-center">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
              <p className="text-lg font-bold text-teal-700">{totalSlots}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Slots</p>
            </div>
            {uniqueCourses > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
                <p className="text-lg font-bold text-slate-700">{uniqueCourses}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Courses</p>
              </div>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
              <p className="text-lg font-bold text-slate-700">{uniqueStaff}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Staff</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-3 flex-wrap">
        <Filter size={13} className="text-slate-400 shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Staff:</label>
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white">
            <option value="all">All staff</option>
            {allStaff.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Week:</label>
          <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white">
            <option value="all">All</option>
            <option value="Every week">Every week</option>
            <option value="Week A only">Week A only</option>
            <option value="Week B only">Week B only</option>
          </select>
        </div>
      </div>

      {/* ── Staff legend (click to filter) ── */}
      {allStaff.length > 0 && (
        <div className="bg-white border-b border-slate-100 px-6 py-2 flex items-center gap-2 flex-wrap">
          <Users size={12} className="text-slate-400 shrink-0" />
          {/* Shared HoD badge */}
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium bg-amber-50 border-amber-300 text-amber-800">
            <Star size={9} /> All HoD Staff
          </span>
          {allStaff.map(name => (
            <button key={name}
              onClick={() => setFilterStaff(filterStaff === name ? "all" : name)}
              className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-opacity ${staffColourMap[name]} ${
                filterStaff !== "all" && filterStaff !== name ? "opacity-30" : "opacity-100"
              }`}>
              {name}
            </button>
          ))}
        </div>
      )}

      {/* ── Timetable grid ── */}
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
            <p className="text-sm text-slate-500 font-medium">No timetable entries yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Add slots on any course's <strong>Timetable Slots</strong> tab to see them here.
            </p>
          </div>
        ) : totalSlots === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">No slots match the current filters.</div>
        ) : (
          <div className="grid grid-cols-5 gap-3 min-w-[700px]">
            {DAYS.map(day => (
              <div key={day}>
                {/* Day header */}
                <div className="text-center text-xs font-bold text-slate-600 uppercase tracking-wider bg-white border border-slate-200 rounded-lg py-2 mb-2 shadow-sm">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{DAY_SHORT[day]}</span>
                  <span className="ml-1.5 text-[10px] font-normal text-slate-400">({byDay[day].length})</span>
                </div>

                {/* Slots */}
                <div className="space-y-2">
                  {byDay[day].length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-lg py-6 text-xs text-slate-300 text-center">
                      No lessons
                    </div>
                  ) : (
                    byDay[day].map(slot => {
                      const colour = slot.staffName
                        ? (staffColourMap[slot.staffName] ?? STAFF_COLOURS[0])
                        : STAFF_COLOURS[0];
                      return (
                        <SlotCard
                          key={`${slot.type}-${slot.slotId}`}
                          slot={slot}
                          colour={colour}
                          onClick={slot.type === "course" && slot.courseId
                            ? () => navigate(`/courses/${slot.courseId}`)
                            : undefined}
                        />
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
