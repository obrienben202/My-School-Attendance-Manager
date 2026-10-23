import { useParams } from "wouter";
import { useListCourses } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Monitor, Wifi, Projector } from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-2 py-1.5">
      <span className="w-40 shrink-0 text-sm font-semibold text-slate-700">{label}</span>
      <span className="text-sm text-slate-900">{value ?? "—"}</span>
    </div>
  );
}

const ROOM_TYPES = ["Classroom", "Laboratory", "Sports Hall", "IT Suite", "Music Room", "Art Room", "Library", "Conference Room"];
const SITES = ["Main Campus", "North Block", "South Annexe", "Sports Centre"];
const CAPACITIES = [20, 25, 30, 32, 15, 28, 40, 18];
const FACILITIES_LIST = [
  ["Interactive Whiteboard", "Projector", "Wi-Fi"],
  ["PC Workstations x30", "Wi-Fi", "Projector"],
  ["Sports Equipment", "Changing Facilities"],
  ["PC Workstations x24", "Interactive Whiteboard", "Wi-Fi"],
  ["Piano", "Sound System", "Recording Equipment"],
  ["Art Supplies Storage", "Kiln", "Sinks"],
  ["Books", "PCs x10", "Quiet Study Area"],
  ["Video Conferencing", "Whiteboard", "Wi-Fi"],
];

export default function RoomDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: courses, isLoading } = useListCourses();

  const rooms = [...new Set((courses ?? []).map(c => c.room).filter(Boolean))];
  const roomName = rooms[id % rooms.length] ?? `Room ${id}`;
  const roomType = ROOM_TYPES[id % ROOM_TYPES.length];
  const site = SITES[id % SITES.length];
  const capacity = CAPACITIES[id % CAPACITIES.length];
  const facilities = FACILITIES_LIST[id % FACILITIES_LIST.length];
  const coursesInRoom = (courses ?? []).filter(c => c.room === roomName);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-800">Room Details</h1>

      {/* Main info card */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-800">{roomName} — {roomType}</p>
        </div>

        <div className="px-5 py-4 grid grid-cols-2 gap-x-12">
          <div>
            <InfoRow label="Room Code" value={roomName} />
            <InfoRow label="Room Type" value={roomType} />
            <InfoRow label="Capacity" value={capacity} />
            <InfoRow label="Size" value={`${Math.round(capacity * 2.5)} m²`} />
          </div>
          <div>
            <InfoRow label="Site" value={site} />
            <InfoRow label="Description" value={`${roomType} — ${roomName}`} />
            <InfoRow label="Address" value={`${site}, School Road`} />
            <InfoRow label="Facilities" value={facilities.join(", ")} />
          </div>
        </div>
      </div>

      {/* Facilities icons */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-700 text-sm">Facilities</p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-3">
          {facilities.map(f => (
            <div key={f} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-full">
              {f.includes("Wi-Fi") ? <Wifi className="w-3 h-3" /> :
               f.includes("Projector") || f.includes("Interactive") ? <Projector className="w-3 h-3" /> :
               f.includes("PC") || f.includes("Video") ? <Monitor className="w-3 h-3" /> :
               <MapPin className="w-3 h-3" />}
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Courses using this room */}
      <div className="border border-slate-200 rounded bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-700 text-sm">Courses Using This Room</p>
        </div>
        {coursesInRoom.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">No courses currently assigned to this room.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-600 px-5 py-2">Course Code</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Course Name</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Staff</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coursesInRoom.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 text-sky-700 font-medium">{c.code}</td>
                  <td className="px-3 py-2 text-slate-700">{c.name}</td>
                  <td className="px-3 py-2 text-slate-600">{c.staffName ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{c.enrolledCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
