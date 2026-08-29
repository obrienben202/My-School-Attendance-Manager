import { useLocation, useParams } from "wouter";
import {
  useGetStaffCorrespondence,
  useGetStaffRegisterHistory,
  useGetStaffRoomBookings,
  useGetStaffTimetable,
} from "@workspace/api-client-react";
import { AlertCircle, ArrowLeft, CalendarClock, ChevronRight, Mail, MapPin, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type WorkflowKind = "room-bookings" | "timetable" | "register-history" | "correspondence";

const WORKFLOW_COPY: Record<WorkflowKind, { title: string; icon: typeof CalendarClock }> = {
  "room-bookings": { title: "Staff Room Bookings", icon: MapPin },
  timetable: { title: "Staff Timetable", icon: CalendarClock },
  "register-history": { title: "Register History", icon: RefreshCw },
  correspondence: { title: "Staff Correspondence", icon: Mail },
};

function StaffWorkflow({ kind }: { kind: WorkflowKind }) {
  const params = useParams();
  const [, navigate] = useLocation();
  const id = params.id ?? "";
  const copy = WORKFLOW_COPY[kind];
  const Icon = copy.icon;

  const timetableQuery = useGetStaffTimetable(id, { query: { enabled: !!id && kind === "timetable", retry: false } as any });
  const historyQuery = useGetStaffRegisterHistory(id, { query: { enabled: !!id && kind === "register-history", retry: false } as any });
  const bookingsQuery = useGetStaffRoomBookings(id, { query: { enabled: !!id && kind === "room-bookings", retry: false } as any });
  const correspondenceQuery = useGetStaffCorrespondence(id, { query: { enabled: !!id && kind === "correspondence", retry: false } as any });

  const activeQuery =
    kind === "timetable" ? timetableQuery :
    kind === "register-history" ? historyQuery :
    kind === "room-bookings" ? bookingsQuery :
    correspondenceQuery;

  const staffName = activeQuery.data?.staffName;

  if (activeQuery.isLoading) {
    return (
      <div className="max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!id || activeQuery.isError || !activeQuery.data) {
    return (
      <div className="max-w-xl rounded border border-red-200 bg-white p-6">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <h1 className="font-semibold">{copy.title} unavailable</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {activeQuery.error instanceof Error && activeQuery.error.message
            ? activeQuery.error.message
            : "This staff view could not be loaded. You may not have access, or the staff record may no longer exist."}
        </p>
        <div className="mt-4 flex gap-3">
          <button onClick={() => activeQuery.refetch()} className="text-sm font-medium text-sky-700 hover:underline">Try again</button>
          <button onClick={() => navigate(`/staff/${encodeURIComponent(id)}`)} className="text-sm font-medium text-slate-600 hover:underline">
            Back to Staff Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <button
          onClick={() => navigate(`/staff/${encodeURIComponent(id)}`)}
          className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Staff Details
        </button>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-sky-700" />
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{copy.title}</h1>
            <p className="text-sm text-slate-500">{staffName}</p>
          </div>
        </div>
      </div>

      {kind === "timetable" && timetableQuery.data && (
        <div className="overflow-hidden rounded border border-slate-200 bg-white">
          {timetableQuery.data.records.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">No timetable records are available for this staff member.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {["Day", "Time", "Course / Activity", "Group", "Room", "Week Pattern"].map(label => (
                      <th key={label} className="px-4 py-2 text-left text-xs font-semibold text-slate-600">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timetableQuery.data.records.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-700">{record.day ?? "Not provided"}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-700">{record.startTime}–{record.endTime}</td>
                      <td className="px-4 py-2">
                        {record.courseId ? (
                          <button
                            onClick={() => navigate(`/courses/${record.courseId}?staff=${encodeURIComponent(id)}`)}
                            className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                          >
                            <ChevronRight className="h-3 w-3" />
                            {record.courseCode ? `${record.courseCode} — ` : ""}{record.courseName ?? record.description}
                          </button>
                        ) : (
                          <span className="text-slate-700">{record.description ?? "Not provided"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{record.groupLabel ?? "Not provided"}</td>
                      <td className="px-4 py-2 text-slate-600">{record.room ?? "Not provided"}</td>
                      <td className="px-4 py-2 text-slate-600">{record.weekPattern ?? "Not provided"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {kind === "register-history" && historyQuery.data && (
        <div className="overflow-hidden rounded border border-slate-200 bg-white">
          {historyQuery.data.records.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">No register sessions are available for this staff member.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {["Course", "Room", "Scheduled slots", "Marked slots", "Last attendance", "P", "A", "L", "Auth."].map(label => (
                      <th key={label} className="px-3 py-2 text-left text-xs font-semibold text-slate-600">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyQuery.data.records.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => navigate(`/courses/${record.courseId}?staff=${encodeURIComponent(id)}`)}
                          className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                        >
                          <ChevronRight className="h-3 w-3" /> {record.courseCode} — {record.courseName}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{record.room ?? "Not provided"}</td>
                      <td className="px-3 py-2 text-slate-600">{record.scheduleCount}</td>
                      <td className="px-3 py-2 text-slate-600">{record.markedScheduleCount}</td>
                      <td className="px-3 py-2 text-slate-600">{record.lastAttendanceDate ?? "No attendance records"}</td>
                      <td className="px-3 py-2 text-emerald-700">{record.present}</td>
                      <td className="px-3 py-2 text-red-700">{record.absent}</td>
                      <td className="px-3 py-2 text-amber-700">{record.late}</td>
                      <td className="px-3 py-2 text-blue-700">{record.authorised}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(kind === "room-bookings" || kind === "correspondence") && "message" in activeQuery.data && (
        <div className="rounded border border-slate-200 bg-white px-5 py-10 text-center">
          <Icon className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">{activeQuery.data.message}</p>
          <p className="mt-1 text-xs text-slate-400">No records can be displayed from the current source.</p>
        </div>
      )}
    </div>
  );
}

export function StaffRoomBookings() {
  return <StaffWorkflow kind="room-bookings" />;
}

export function StaffTimetable() {
  return <StaffWorkflow kind="timetable" />;
}

export function StaffRegisterHistory() {
  return <StaffWorkflow kind="register-history" />;
}

export function StaffCorrespondence() {
  return <StaffWorkflow kind="correspondence" />;
}