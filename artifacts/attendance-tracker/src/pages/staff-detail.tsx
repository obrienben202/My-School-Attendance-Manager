import { useParams } from "wouter";
import { useListCourses } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

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

const POSITIONS = ["Teacher", "Head of Department", "Senior Teacher", "Assistant Principal", "Subject Leader", "Form Tutor"];
const DEPARTMENTS = ["Business & Administration", "Mathematics", "English", "Science", "Arts", "Computing", "PE", "MFL"];

export default function StaffDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: courses, isLoading } = useListCourses();

  const staffNames = [...new Set((courses ?? []).map(c => c.staffName).filter(Boolean) as string[])];
  const staffName = staffNames[id % staffNames.length] ?? `Staff ${id}`;
  const [lastName, firstName] = staffName.includes(" ") ? staffName.split(" ").reverse() : [staffName, ""];
  const position = POSITIONS[id % POSITIONS.length];
  const department = DEPARTMENTS[id % DEPARTMENTS.length];
  const staffCode = `S${String(id).padStart(4, "0")}`;
  const staffCourses = (courses ?? []).filter(c => c.staffName === staffName);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-800">Staff Details</h1>

      {/* Main info card */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-800">{staffName}</p>
        </div>

        <div className="px-5 py-4 grid grid-cols-2 gap-x-12">
          <div>
            <InfoRow label="Staff Code" value={staffCode} />
            <InfoRow label="Forename" value={firstName || staffName} />
            <InfoRow label="Surname" value={lastName || "—"} />
            <InfoRow label="Full Name" value={staffName} />
          </div>
          <div>
            <InfoRow label="Organisation" value={department} />
            <InfoRow label="Position" value={position} />
            <InfoRow label="Email" value={`${staffCode.toLowerCase()}@school.edu`} />
            <InfoRow label="Phone" value="—" />
          </div>
        </div>
      </div>

      {/* Organisations */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-700 text-sm">Organisations</p>
        </div>
        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-600 pb-2 pr-8">Organisation Name</th>
                <th className="text-left text-xs font-semibold text-slate-600 pb-2">Position</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2 pr-8 text-slate-700">{department}</td>
                <td className="py-2 text-slate-700">{position}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2 pr-8 text-slate-700">School Administration</td>
                <td className="py-2 text-slate-700">Staff Member</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Courses taught */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-700 text-sm">Courses Taught</p>
        </div>
        {staffCourses.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">No courses currently assigned to this staff member.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-600 px-5 py-2">Course Code</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Course Name</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Room</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffCourses.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 text-sky-700 font-medium">{c.code}</td>
                  <td className="px-3 py-2 text-slate-700">{c.name}</td>
                  <td className="px-3 py-2 text-slate-600">{c.room ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{c.enrolledCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Staff Links */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-700 text-sm">Staff Links</p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-3">
          {["Staff Room Bookings", "Timetable", "Register History", "Correspondence"].map(link => (
            <button key={link} className="text-sm text-sky-700 hover:underline bg-sky-50 border border-sky-200 rounded px-3 py-1.5 hover:bg-sky-100 transition-colors">
              {link}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
