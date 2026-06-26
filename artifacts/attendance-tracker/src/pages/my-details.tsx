import { useAuth } from "@workspace/replit-auth-web";
import { useListCourses } from "@workspace/api-client-react";
import {
  UserCircle, Mail, Phone, MapPin, Building2, BadgeCheck,
  Calendar, BookOpen, ClipboardList, Info, ExternalLink,
  ShieldCheck, Lock,
} from "lucide-react";
import { Link } from "wouter";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-teal-700">{icon}</span>
        <h2 className="text-sm font-bold text-gray-700">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="w-44 shrink-0 text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm text-gray-800">{value || "—"}</span>
    </div>
  );
}

// ─── Sample employment data ────────────────────────────────────────────────────
// In a real EBS deployment these would come from the staff record in the back-end.

const EMPLOYMENT = {
  staffCode: "S0001",
  title: "Mr",
  knownAs: "",
  gender: "Not disclosed",
  dateOfBirth: "—",
  niNumber: "•••• ••••",
  startDate: "01 Sep 2019",
  contractType: "Permanent",
  fte: "1.0 (Full-time)",
  position: "Senior Teacher",
  department: "Mathematics",
  organisation: "Riverside College",
  room: "Maths Block — Room M4",
  phone: "01234 567890",
  mobile: "—",
  address: "Riverside College, Education Road, Riverside, RS1 2AB",
  roles: ["Create Schedules", "Safeguarding Tutor", "Reports User"],
};

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function MyDetails() {
  const { user } = useAuth();
  const { data: courses = [] } = useListCourses({ query: { enabled: true } as any });

  const firstName = user?.firstName ?? "Staff";
  const lastName = user?.lastName ?? "Member";
  const fullName = `${firstName} ${lastName}`;
  const email = user?.email ?? "—";
  const avatarUrl = user?.profileImageUrl;

  // Filter courses loosely attributed to this user (demo — in real EBS, filtered by staffId)
  const myCourses = courses.slice(0, 5);

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center gap-3">
        <UserCircle size={18} className="text-teal-700" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Details</h1>
          <p className="text-sm text-gray-500">Your staff record — read-only. Contact your administrator to update any details.</p>
        </div>
      </div>

      {/* Read-only notice */}
      <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-700">
        <Lock size={12} className="shrink-0" />
        <span>
          <strong>Read-only view.</strong> You cannot edit your details from this page. Any changes must be made by your administrator in the EBS back-end system.
        </span>
      </div>

      <div className="px-6 py-6 max-w-4xl space-y-5">

        {/* Profile card */}
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 flex items-center gap-5">
          <div className="shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-16 h-16 rounded-full object-cover border-2 border-teal-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center border-2 border-teal-200">
                <span className="text-2xl font-bold text-teal-700">
                  {firstName[0]}{lastName[0]}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{EMPLOYMENT.title} {fullName}</h2>
            <p className="text-sm text-gray-500">{EMPLOYMENT.position} · {EMPLOYMENT.department}</p>
            <p className="text-xs text-gray-400 mt-0.5">{EMPLOYMENT.organisation}</p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <span className="text-xs font-mono text-gray-500 bg-gray-100 border border-gray-200 rounded px-2 py-0.5">
              Staff code: {EMPLOYMENT.staffCode}
            </span>
            <div className="flex flex-wrap gap-1 justify-end">
              {EMPLOYMENT.roles.map((r) => (
                <span key={r} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full font-medium">
                  <ShieldCheck size={9} /> {r}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Personal details */}
          <Section title="Personal Details" icon={<UserCircle size={14} />}>
            <Row label="Title" value={EMPLOYMENT.title} />
            <Row label="Forename" value={firstName} />
            <Row label="Known as" value={EMPLOYMENT.knownAs || firstName} />
            <Row label="Surname" value={lastName} />
            <Row label="Full name" value={fullName} />
            <Row label="Gender" value={EMPLOYMENT.gender} />
            <Row label="Date of birth" value={EMPLOYMENT.dateOfBirth} />
            <Row label="NI number" value={EMPLOYMENT.niNumber} />
          </Section>

          {/* Contact details */}
          <Section title="Contact Details" icon={<Mail size={14} />}>
            <div className="flex items-center gap-2 py-2 border-b border-gray-50">
              <Mail size={13} className="text-gray-400 shrink-0" />
              <span className="w-28 shrink-0 text-xs font-semibold text-gray-500">Email</span>
              <span className="text-sm text-gray-800 break-all">{email}</span>
            </div>
            <div className="flex items-center gap-2 py-2 border-b border-gray-50">
              <Phone size={13} className="text-gray-400 shrink-0" />
              <span className="w-28 shrink-0 text-xs font-semibold text-gray-500">Phone</span>
              <span className="text-sm text-gray-800">{EMPLOYMENT.phone}</span>
            </div>
            <div className="flex items-center gap-2 py-2 border-b border-gray-50">
              <Phone size={13} className="text-gray-400 shrink-0" />
              <span className="w-28 shrink-0 text-xs font-semibold text-gray-500">Mobile</span>
              <span className="text-sm text-gray-800">{EMPLOYMENT.mobile || "—"}</span>
            </div>
            <div className="flex items-start gap-2 py-2">
              <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
              <span className="w-28 shrink-0 text-xs font-semibold text-gray-500">Address</span>
              <span className="text-sm text-gray-800 leading-snug">{EMPLOYMENT.address}</span>
            </div>
          </Section>

          {/* Employment details */}
          <Section title="Employment Details" icon={<Building2 size={14} />}>
            <Row label="Staff code" value={EMPLOYMENT.staffCode} />
            <Row label="Department" value={EMPLOYMENT.department} />
            <Row label="Position" value={EMPLOYMENT.position} />
            <Row label="Organisation" value={EMPLOYMENT.organisation} />
            <Row label="Room" value={EMPLOYMENT.room} />
            <Row label="Contract type" value={EMPLOYMENT.contractType} />
            <Row label="FTE" value={EMPLOYMENT.fte} />
            <Row label="Start date" value={EMPLOYMENT.startDate} />
          </Section>

          {/* Organisations */}
          <Section title="Organisations" icon={<BadgeCheck size={14} />}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Organisation</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2">Position</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2">Start</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="py-2 pr-4 text-gray-700">{EMPLOYMENT.department}</td>
                  <td className="py-2 text-gray-700">{EMPLOYMENT.position}</td>
                  <td className="py-2 text-gray-500 text-xs">{EMPLOYMENT.startDate}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-gray-700">{EMPLOYMENT.organisation}</td>
                  <td className="py-2 text-gray-700">Staff Member</td>
                  <td className="py-2 text-gray-500 text-xs">{EMPLOYMENT.startDate}</td>
                </tr>
              </tbody>
            </table>
          </Section>
        </div>

        {/* Courses / timetable */}
        <Section title="My Courses" icon={<BookOpen size={14} />}>
          {myCourses.length === 0 ? (
            <p className="text-sm text-gray-400">No courses currently assigned.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Code", "Course name", "Room", "Enrolled", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myCourses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 pr-4 font-mono text-xs text-teal-700 font-semibold">{c.code}</td>
                    <td className="py-2 pr-4 text-gray-800">{c.name}</td>
                    <td className="py-2 pr-4 text-gray-500">{c.room ?? "—"}</td>
                    <td className="py-2 pr-4 text-gray-500">{c.enrolledCount}</td>
                    <td className="py-2">
                      <Link href={`/courses/${c.id}`} className="text-[10px] text-teal-700 hover:underline flex items-center gap-0.5">
                        View <ExternalLink size={9} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Reports links — docs state timetable reports are accessible from Reports section when My Details is selected */}
        <Section title="Reports &amp; Links" icon={<ClipboardList size={14} />}>
          <p className="text-xs text-gray-500 mb-3">
            Timetable and other reports are accessible from the Reports section of the navigation pane.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "My Attendance Reports", href: "/reports" },
              { label: "My Timetable", href: "/reports" },
              { label: "Register History", href: "/registers" },
              { label: "My Schedules", href: "/schedules" },
              { label: "Planned Absences", href: "/planned-absence" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded px-3 py-1.5 hover:bg-teal-100 transition-colors font-medium"
              >
                <ExternalLink size={11} /> {label}
              </Link>
            ))}
          </div>
        </Section>

        {/* Admin notice */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Need to update your details?</p>
            <p className="text-xs leading-relaxed">
              Your personal details, contact information, and employment record are managed by your institution's administrator in the EBS back-end system.
              Please contact your administrator or HR department to request any changes.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
