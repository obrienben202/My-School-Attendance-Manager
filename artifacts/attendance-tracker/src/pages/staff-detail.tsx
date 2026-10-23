import { useLocation, useParams } from "wouter";
import { useGetStaff } from "@workspace/api-client-react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-2">
      <span className="shrink-0 text-sm font-semibold text-slate-700 sm:w-40">{label}</span>
      <span className={value === null || value === undefined || value === "" ? "text-sm text-slate-400" : "text-sm text-slate-900"}>
        {value === null || value === undefined || value === "" ? "Not provided" : value}
      </span>
    </div>
  );
}

const STAFF_LINKS = [
  { label: "Staff Room Bookings", path: "room-bookings" },
  { label: "Timetable", path: "timetable" },
  { label: "Register History", path: "register-history" },
  { label: "Correspondence", path: "correspondence" },
] as const;

export default function StaffDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const id = params.id ?? "";
  const { data: staff, isLoading, isError, error, refetch } = useGetStaff(id, {
    query: { enabled: !!id, retry: false } as any,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!id || isError || !staff) {
    return (
      <div className="max-w-xl rounded border border-red-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-800">Staff record unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error instanceof Error && error.message
            ? error.message
            : "This staff identifier is unknown or the record is no longer available."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => refetch()} className="text-sm font-medium text-sky-700 hover:underline">Try again</button>
          <button onClick={() => navigate("/")} className="text-sm font-medium text-slate-600 hover:underline">Back to Staff Search</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <button onClick={() => navigate("/")} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Staff Search
        </button>
        <h1 className="text-xl font-semibold text-slate-800">Staff Details</h1>
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <p className="font-semibold text-slate-800">{staff.fullName}</p>
        </div>
        <div className="grid grid-cols-1 gap-x-12 px-4 py-4 sm:px-5 md:grid-cols-2">
          <div>
            <InfoRow label="Staff Code" value={staff.staffCode} />
            <InfoRow label="Person Code" value={staff.personCode} />
            <InfoRow label="Title" value={staff.title} />
            <InfoRow label="Forename" value={staff.firstName} />
            <InfoRow label="Surname" value={staff.lastName} />
            <InfoRow label="Full Name" value={staff.fullName} />
          </div>
          <div>
            <InfoRow label="Organisation" value={staff.organisation} />
            <InfoRow label="Position" value={staff.position} />
            <InfoRow label="Email" value={staff.email} />
            <InfoRow label="Phone" value={staff.phone} />
          </div>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-slate-700">Organisations</p>
        </div>
        {staff.organisation || staff.position ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-2 text-left text-xs font-semibold text-slate-600">Organisation Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Position</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-5 py-2 text-slate-700">{staff.organisation ?? "Not provided"}</td>
                  <td className="px-3 py-2 text-slate-700">{staff.position ?? "Not provided"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-slate-400 sm:px-5">No organisation assignment is available for this staff member.</div>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-slate-700">Courses Taught</p>
        </div>
        {staff.courses.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400 sm:px-5">No courses are currently assigned to this staff member.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-2 text-left text-xs font-semibold text-slate-600">Course Code</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Course Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Room</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.courses.map(course => (
                  <tr key={course.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2">
                      <button
                        onClick={() => navigate(`/courses/${course.id}?staff=${encodeURIComponent(staff.id)}`)}
                        className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                      >
                        <ChevronRight className="h-3 w-3" /> {course.code}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{course.name}</td>
                    <td className="px-3 py-2 text-slate-600">{course.room ?? "Not provided"}</td>
                    <td className="px-3 py-2 text-slate-600">{course.enrolledCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-slate-700">Staff Links</p>
        </div>
        <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:flex-wrap sm:gap-3 sm:px-5">
          {STAFF_LINKS.map(link => (
            <button
              key={link.path}
              onClick={() => navigate(`/staff/${encodeURIComponent(staff.id)}/${link.path}`)}
              className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-left text-sm text-sky-700 transition-colors hover:bg-sky-100 hover:underline"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}