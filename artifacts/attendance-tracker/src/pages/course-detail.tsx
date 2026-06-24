import { useState } from "react";
import { useParams } from "wouter";
import { useGetCourse, useListAttendanceRecords } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp } from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-2 py-1">
      <span className="w-44 shrink-0 text-sm font-medium text-slate-600">{label}</span>
      <span className="text-sm text-slate-900">{value ?? "—"}</span>
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 text-left rounded-t"
      >
        <span className="font-semibold text-slate-700 text-sm">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 py-4 border-t border-slate-100 bg-white rounded-b">{children}</div>}
    </div>
  );
}

export default function CourseDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: course, isLoading } = useGetCourse(id, { query: { enabled: !!id } });
  const { data: attendance } = useListAttendanceRecords({ courseId: id }, { query: { enabled: !!id } });

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
    return <div className="p-12 text-center text-muted-foreground">Course not found.</div>;
  }

  const presentCount = attendance?.filter(a => a.status === "present").length ?? 0;
  const absentCount = attendance?.filter(a => a.status === "absent").length ?? 0;
  const lateCount = attendance?.filter(a => a.status === "late").length ?? 0;
  const totalPlaces = course.enrolledCount;
  const activePlaces = presentCount;
  const remainingPlaces = Math.max(0, totalPlaces - activePlaces);

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Page title */}
      <h1 className="text-xl font-semibold text-slate-800">Course Details</h1>

      {/* Course heading bar */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-800">
            {course.code} — {course.name}
          </p>
        </div>

        {/* Course details grid */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-x-12">
            {/* Left column */}
            <div>
              <InfoRow label="Course Code" value={course.code} />
              <InfoRow label="Status" value="Live/Published. Available for use (ACTIVE)" />
              <InfoRow label="UI Level" value="Prog Year" />
              <InfoRow label="Owning Org" value={course.staffName ? "Business & Administration" : "—"} />
              <InfoRow label="End Date" value="—" />
            </div>
            {/* Right column */}
            <div>
              <InfoRow label="Calendar Occurrence" value="Current Year" />
              <InfoRow label="Course Name" value={course.name} />
              <InfoRow label="Offering Org" value="—" />
              <InfoRow label="Start Date" value="—" />
              <InfoRow label="Course Hours" value="—" />
            </div>
          </div>
        </div>

        {/* Additional info row */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Year Group</p>
            <p className="text-sm font-medium text-slate-800">{course.yearGroup ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Room</p>
            <p className="text-sm font-medium text-slate-800">{course.room ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Staff</p>
            <p className="text-sm font-medium text-slate-800">{course.staffName ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Course Place Totals */}
      <CollapsibleSection title="Course Place Totals">
        <div className="grid grid-cols-2 gap-x-12 gap-y-1">
          <div>
            <InfoRow label="Total Places" value={totalPlaces} />
            <InfoRow label="Transferred Places" value={0} />
            <InfoRow label="Non Starter Places" value={absentCount} />
            <InfoRow label="Waiting" value={0} />
          </div>
          <div>
            <InfoRow label="Active Places" value={activePlaces} />
            <InfoRow label="Withdraw Places" value={0} />
            <InfoRow label="Finished Places" value={lateCount} />
            <InfoRow label="Remaining Places" value={remainingPlaces} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Recent Registers */}
      <CollapsibleSection title="Recent Registers" defaultOpen={false}>
        {attendance?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="pb-1 pr-4">Student</th>
                <th className="pb-1 pr-4">Date</th>
                <th className="pb-1">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendance.map(r => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-4 text-slate-700">{r.studentName ?? "—"}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{r.date}</td>
                  <td className="py-1.5">
                    <span className={`font-semibold capitalize text-xs ${
                      r.status === "present" ? "text-emerald-600" :
                      r.status === "absent" ? "text-red-600" :
                      r.status === "late" ? "text-amber-600" : "text-blue-600"
                    }`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">No attendance records for this course.</p>
        )}
      </CollapsibleSection>
    </div>
  );
}
