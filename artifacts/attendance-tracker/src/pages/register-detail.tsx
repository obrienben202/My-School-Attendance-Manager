import { useState } from "react";
import { useParams } from "wouter";
import { useListCourses } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

function InfoRow({ label, value, link = false }: { label: string; value?: string | number | null; link?: boolean }) {
  return (
    <div className="flex gap-2 py-1.5">
      <span className="w-40 shrink-0 text-sm font-semibold text-slate-700">{label}</span>
      {link ? (
        <span className="text-sm text-sky-700 hover:underline cursor-pointer">{value ?? "—"}</span>
      ) : (
        <span className="text-sm text-slate-900">{value ?? "—"}</span>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 text-left rounded-t"
      >
        <span className="font-semibold text-slate-700 text-sm">
          {title}
          {count !== undefined && ` (${count})`}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-teal-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-teal-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-white rounded-b">
          {children}
        </div>
      )}
    </div>
  );
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const START_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

export default function RegisterDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: courses, isLoading } = useListCourses();

  const course = courses?.find((c) => c.id === id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Register not found.
      </div>
    );
  }

  const eventCode = `${course.code}-${new Date().getFullYear().toString().slice(2)}-${id}`;
  const startTime = START_TIMES[id % START_TIMES.length];
  const [startH, startM] = startTime.split(":").map(Number);
  const endTime = `${String(startH + 1).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
  const dayOfWeek = DAYS[id % DAYS.length];

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-800">Register Details</h1>

      {/* Heading bar */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-800">
            {course.name} ({eventCode})
          </p>
        </div>

        {/* Info grid */}
        <div className="px-5 py-4 grid grid-cols-2 gap-x-12">
          <div>
            <InfoRow label="Event Code" value={eventCode} />
            <InfoRow label="Event Name" value={course.name} />
            <InfoRow label="Start Date" value="01/08/2024" />
            <InfoRow label="No. of Students" value={course.enrolledCount} />
            <InfoRow label="Room(s)" value={course.room ?? "—"} />
          </div>
          <div>
            <InfoRow label="Event Type" value="Class" />
            <InfoRow label="Period" value="Current Year" />
            <InfoRow label="End Date" value="31/07/2025" />
            <InfoRow label="Staff" value={course.staffName ?? "—"} link />
            <InfoRow label="Course(s)" value={course.name} link />
          </div>
        </div>
      </div>

      {/* Timings */}
      <CollapsibleSection title="Timings" count={1}>
        <div className="px-4 py-3">
          {/* Export / Filter bar */}
          <div className="flex items-center justify-end gap-2 mb-3 text-xs text-slate-500">
            <span>Filter:</span>
            <input className="border border-slate-300 rounded px-2 py-0.5 text-xs w-32 outline-none focus:ring-1 focus:ring-teal-400" />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {[
                  "Day Of Week",
                  "Week Pattern",
                  "Start Time",
                  "End Time",
                  "Break",
                ].map((col) => (
                  <th
                    key={col}
                    className="text-left text-xs font-semibold text-slate-600 pb-2 pr-6"
                  >
                    <span className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900">
                      {col}{" "}
                      <ChevronsUpDown className="w-3 h-3 opacity-50" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2 pr-6 text-slate-700">{dayOfWeek}</td>
                <td className="py-2 pr-6 text-slate-700">1-49,51-52</td>
                <td className="py-2 pr-6 text-slate-700">{startTime}</td>
                <td className="py-2 pr-6 text-slate-700">{endTime}</td>
                <td className="py-2 pr-6 text-slate-700">0</td>
              </tr>
            </tbody>
          </table>

          {/* Pagination footer */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-500">
              Showing 1 to 1 of 1 entries
            </span>
            <div className="flex gap-1">
              <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>
                ‹
              </button>
              <button className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-500 text-xs flex items-center justify-center hover:bg-slate-100 disabled:opacity-40" disabled>
                ›
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
