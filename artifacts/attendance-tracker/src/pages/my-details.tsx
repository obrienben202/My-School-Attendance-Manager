import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile, useListCourses } from "@workspace/api-client-react";
import {
  ArrowRight, BookOpen, BriefcaseBusiness, CalendarDays, ClipboardList,
  ExternalLink, FileText, Info, Landmark, LockKeyhole, Mail, Printer,
  UserRound, UsersRound,
} from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PersonalSlot {
  id: number;
  day: string;
  startTime: string | null;
  endTime: string | null;
  description: string;
  groupLabel: string | null;
  room: string | null;
}

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const recorded = (value: string | null | undefined) => value?.trim() || "Not recorded";
const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const roleLabel = (role: string | undefined) => ({
  admin: "Administrator", hod: "Head of department", staff: "Staff member", office: "Office staff",
}[role ?? ""] ?? "Not recorded");

function DetailCard({
  title, icon: Icon, children,
}: {
  title: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#dde7e8] bg-[#fefefd] shadow-[0_2px_10px_rgba(24,59,68,0.035)] dark:border-border dark:bg-card">
      <div className="flex items-center gap-2.5 border-b border-[#e8eeee] px-5 py-3.5 dark:border-border">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e9f5f2] text-[#287c75] dark:bg-teal-900/40 dark:text-teal-300"><Icon size={15} strokeWidth={1.8} /></span>
        <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[#1d3044] dark:text-foreground">{title}</h2>
      </div>
      <div className="px-5 py-1">{children}</div>
    </section>
  );
}

function Facts({ items }: { items: { label: string; value?: string | null }[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0 border-b border-[#eef1f1] py-3 pr-3 last:border-0 sm:[&:nth-last-child(2)]:border-b-0 dark:border-border">
          <dt className="mb-1 text-[10px] font-bold uppercase tracking-[0.105em] text-[#7b8a98] dark:text-muted-foreground">{label}</dt>
          <dd className={`break-words text-[13px] leading-snug ${!value || value === "Not recorded" ? "italic text-[#94a0aa] dark:text-muted-foreground" : "font-medium text-[#23394a] dark:text-foreground"}`} data-testid={`text-detail-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            {recorded(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character] ?? character));
}

function printTimetable(name: string, slots: PersonalSlot[]) {
  const rows = slots.map(slot => `<tr><td>${escapeHtml(slot.day)}</td><td>${escapeHtml(slot.startTime ?? "Not recorded")}–${escapeHtml(slot.endTime ?? "Not recorded")}</td><td>${escapeHtml(slot.description)}</td><td>${escapeHtml(slot.groupLabel ?? "")}</td><td>${escapeHtml(slot.room ?? "")}</td></tr>`).join("");
  const windowToPrint = window.open("", "_blank", "width=900,height=700");
  if (!windowToPrint) return;
  windowToPrint.document.write(`<!doctype html><html><head><title>My timetable</title><style>body{font:14px system-ui,sans-serif;color:#23394a;margin:32px}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #dce6e7}th{background:#e9f5f2}</style></head><body><h1>My timetable</h1><p>${escapeHtml(name)}</p><table><thead><tr><th>Day</th><th>Time</th><th>Session</th><th>Group</th><th>Room</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  windowToPrint.document.close();
  windowToPrint.focus();
  windowToPrint.print();
}

export default function MyDetails() {
  const { user } = useAuth();
  const [timetableOpen, setTimetableOpen] = useState(false);
  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useGetMyProfile({
    query: { queryKey: ["my-profile", user?.id], enabled: !!user?.id, staleTime: 0, refetchOnMount: "always" },
  });
  const { data: courses = [], isLoading: coursesLoading, isError: coursesError, refetch: refetchCourses } = useListCourses();
  const { data: slots = [], isLoading: timetableLoading, isError: timetableError, refetch: refetchTimetable } = useQuery<PersonalSlot[]>({
    queryKey: ["my-timetable"],
    queryFn: async () => {
      const response = await fetch("/api/staff/my-timetable", { credentials: "include" });
      if (!response.ok) throw new Error("Could not load timetable");
      return response.json();
    },
    enabled: timetableOpen,
  });

  const firstName = user?.firstName?.trim();
  const lastName = user?.lastName?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const avatarInitials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "AT";
  // A complete name and an exact, whitespace/case-normalised staffName match are required.
  // In particular, never treat the first few courses in the catalogue as assignments.
  const myCourses = fullName && firstName && lastName
    ? courses.filter(course => course.staffName && normalizeName(course.staffName) === normalizeName(fullName))
    : [];

  return (
    <div className="min-h-[100dvh] rounded-xl bg-[#f3f7fa] px-4 py-6 text-[#23394a] sm:px-7 sm:py-7 dark:bg-background dark:text-foreground">
      <div className="mx-auto max-w-[1140px]">
        <header className="mb-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[#8695a3]">
            <Link href="/" className="hover:text-[#257c75]" data-testid="link-home">Home</Link>
            <span>/</span><span>My Details</span>
          </div>
          <h1 className="text-[25px] font-bold leading-tight tracking-[-0.035em] text-[#1c3045] dark:text-foreground">My details</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[#758595] dark:text-muted-foreground">
            Your account information, course assignments and useful workspace links, all in one place.
          </p>
        </header>

        <section className="mb-3 overflow-hidden rounded-xl border border-[#dce6e7] border-t-[3px] border-t-[#26877e] bg-[#fefefd] shadow-[0_5px_18px_rgba(24,59,68,0.06)] dark:border-border dark:border-t-teal-500 dark:bg-card" aria-label="Account identity">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[4px] border-[#eff9f6] bg-[#dff2ed] text-[20px] font-bold text-[#167169] shadow-sm dark:border-teal-900/30 dark:bg-teal-900/50 dark:text-teal-200">
              {user?.profileImageUrl ? <img src={user.profileImageUrl} alt="" className="h-full w-full object-cover" /> : avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[19px] font-bold tracking-[-0.025em] text-[#1d3044] dark:text-foreground" data-testid="text-account-name">{fullName || "Name not recorded"}</h2>
              <p className="mt-0.5 text-[13px] text-[#758595] dark:text-muted-foreground">{roleLabel(user?.role)}{user?.department ? ` · ${user.department}` : ""}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#edf6f3] px-2.5 py-1 text-[10px] font-bold text-[#26756d] dark:bg-teal-900/30 dark:text-teal-300">
                <LockKeyhole size={11} /> Signed-in profile
              </span>
            </div>
            <div className="min-w-0 sm:max-w-[45%] sm:text-right">
              <p className="break-all text-[13px] font-semibold text-[#263d4d] dark:text-foreground" data-testid="text-account-email">{recorded(profile?.email ?? user?.email)}</p>
              <p className="mt-1 text-[11px] text-[#83919e] dark:text-muted-foreground">Account details are read-only</p>
            </div>
          </div>
        </section>

        {profileLoading && <p className="mb-3 text-[12px] text-[#758595]" role="status">Loading verified profile details…</p>}
        {profileError && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-900" role="alert">
            Verified contact and employment details could not be loaded. <button type="button" className="font-semibold underline" onClick={() => refetchProfile()}>Try again</button>
          </div>
        )}
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-[#dbe9f0] bg-[#ecf5f9] px-4 py-3 text-[#416176] dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200" role="note">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div className="text-[12px] leading-relaxed">
            <p className="font-bold">Need to update your details?</p>
            <p className="mt-0.5">This page is read-only. Contact your administrator or HR team to correct your account, contact or employment information.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <DetailCard title="Personal Details" icon={UserRound}>
            <Facts items={[
              { label: "Forename", value: profile?.firstName ?? firstName }, { label: "Surname", value: profile?.lastName ?? lastName },
              { label: "Title" }, { label: "Date of birth" },
              { label: "Gender" }, { label: "Nationality" },
            ]} />
          </DetailCard>
          <DetailCard title="Contact Details" icon={Mail}>
            <Facts items={[
              { label: "Email", value: profile?.email ?? user?.email }, { label: "Phone", value: profile?.phone },
              { label: "Address", value: profile?.address }, { label: "Postcode", value: profile?.postcode },
            ]} />
          </DetailCard>
          <DetailCard title="Employment Details" icon={BriefcaseBusiness}>
            <Facts items={[
              { label: "Staff code", value: profile?.staffCode }, { label: "Job title", value: profile?.jobTitle },
              { label: "Department", value: profile?.department ?? user?.department }, { label: "Start date", value: profile?.startDate },
              { label: "Contract" }, { label: "Account role", value: roleLabel(profile?.role ?? user?.role) },
            ]} />
          </DetailCard>
          <DetailCard title="Organisation" icon={Landmark}>
            <Facts items={[
              { label: "Organisation", value: profile?.organisation }, { label: "Provider" },
              { label: "Site" }, { label: "Academic year" },
            ]} />
          </DetailCard>
        </div>

        <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1.9fr)_minmax(250px,0.9fr)]">
          <section className="min-w-0 overflow-hidden rounded-xl border border-[#dde7e8] bg-[#fefefd] shadow-[0_2px_10px_rgba(24,59,68,0.035)] dark:border-border dark:bg-card">
            <div className="flex items-center justify-between border-b border-[#e8eeee] px-5 py-3.5 dark:border-border">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e9f5f2] text-[#287c75] dark:bg-teal-900/40 dark:text-teal-300"><BookOpen size={15} /></span>
                <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[#1d3044] dark:text-foreground">My Courses</h2>
              </div>
              {!coursesLoading && !coursesError && <span className="text-[11px] text-[#8a98a4]" data-testid="text-course-count">{myCourses.length} matched</span>}
            </div>
            {coursesLoading ? (
              <div className="space-y-3 p-5" aria-label="Loading courses">
                {[0, 1, 2].map(index => <div key={index} className="h-9 animate-pulse rounded bg-[#eaf1f2] dark:bg-muted" />)}
              </div>
            ) : coursesError ? (
              <div className="px-5 py-8 text-center text-[13px]">
                <p className="text-[#647987]">Courses could not be loaded.</p>
                <button type="button" onClick={() => refetchCourses()} className="mt-2 font-semibold text-[#227e76] hover:underline" data-testid="button-retry-courses">Try again</button>
              </div>
            ) : myCourses.length === 0 ? (
              <div className="px-5 py-9 text-center">
                <BookOpen className="mx-auto mb-2 text-[#8aafa9]" size={24} strokeWidth={1.5} />
                <p className="text-[13px] font-semibold text-[#344f60]" data-testid="status-no-courses">No courses matched to your account</p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-[#81909c]">Only courses whose staff name matches your account are shown here. Check the course directory for the full list.</p>
                <Link href="/courses" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#227e76] hover:underline" data-testid="link-course-directory">Browse courses <ArrowRight size={13} /></Link>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left">
                    <thead className="bg-[#f8fafb] text-[10px] font-bold uppercase tracking-[0.08em] text-[#7c8b98] dark:bg-muted/40 dark:text-muted-foreground">
                      <tr><th className="px-5 py-2.5">Course code</th><th className="px-3 py-2.5">Course</th><th className="px-3 py-2.5">Year</th><th className="px-3 py-2.5">Enrolled</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5"><span className="sr-only">Open</span></th></tr>
                    </thead>
                    <tbody>
                      {myCourses.map(course => (
                        <tr key={course.id} className="border-t border-[#edf1f1] text-[12px] dark:border-border" data-testid={`row-course-${course.id}`}>
                          <td className="px-5 py-3 font-semibold text-[#18766d] dark:text-teal-300">{course.code}</td>
                          <td className="px-3 py-3 font-semibold text-[#263c4d] dark:text-foreground">{course.name}</td>
                          <td className="px-3 py-3 text-[#647584]">{recorded(course.yearGroup)}</td>
                          <td className="px-3 py-3 text-[#435869]">{course.enrolledCount}</td>
                          <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${course.isActive ? "bg-[#eaf6f1] text-[#27765b]" : "bg-[#f1f2f3] text-[#6d7883]"}`}>{course.isActive ? "Active" : "Inactive"}</span></td>
                          <td className="px-3 py-3"><Link href={`/courses/${course.id}`} className="inline-flex text-[#277e76] hover:text-[#155c55]" aria-label={`View ${course.name}`} data-testid={`link-course-${course.id}`}><ExternalLink size={14} /></Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-[#edf1f1] px-5 py-2.5 text-[11px] text-[#8997a3] dark:border-border">Showing courses matched to your account name.</p>
              </>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dde7e8] bg-[#fefefd] shadow-[0_2px_10px_rgba(24,59,68,0.035)] dark:border-border dark:bg-card">
            <div className="flex items-center gap-2.5 border-b border-[#e8eeee] px-5 py-3.5 dark:border-border">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e9f5f2] text-[#287c75] dark:bg-teal-900/40 dark:text-teal-300"><FileText size={15} /></span>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[#1d3044] dark:text-foreground">Reports &amp; Links</h2>
            </div>
            <nav className="px-4 py-2" aria-label="Related pages">
              <Link href="/attendance" className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-[12px] font-semibold text-[#3a5a6a] hover:bg-[#eff6f5] dark:text-foreground dark:hover:bg-muted" data-testid="link-attendance"><ClipboardList size={14} className="text-[#54817c]" /> eRegisters <ArrowRight size={13} className="ml-auto opacity-60" /></Link>
              <Link href="/courses" className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-[12px] font-semibold text-[#3a5a6a] hover:bg-[#eff6f5] dark:text-foreground dark:hover:bg-muted" data-testid="link-all-courses"><BookOpen size={14} className="text-[#54817c]" /> Course directory <ArrowRight size={13} className="ml-auto opacity-60" /></Link>
              <button type="button" onClick={() => setTimetableOpen(true)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-left text-[12px] font-semibold text-[#3a5a6a] hover:bg-[#eff6f5] dark:text-foreground dark:hover:bg-muted" data-testid="button-my-timetable"><CalendarDays size={14} className="text-[#54817c]" /> My timetable <ArrowRight size={13} className="ml-auto opacity-60" /></button>
              <Link href="/planned-absence" className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-[12px] font-semibold text-[#3a5a6a] hover:bg-[#eff6f5] dark:text-foreground dark:hover:bg-muted" data-testid="link-planned-absence"><UsersRound size={14} className="text-[#54817c]" /> Planned absence <ArrowRight size={13} className="ml-auto opacity-60" /></Link>
              {(user?.role === "admin" || user?.role === "hod" || user?.role === "office") && (
                <Link href="/reports" className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-[12px] font-semibold text-[#3a5a6a] hover:bg-[#eff6f5] dark:text-foreground dark:hover:bg-muted" data-testid="link-reports"><FileText size={14} className="text-[#54817c]" /> Reports <ArrowRight size={13} className="ml-auto opacity-60" /></Link>
              )}
            </nav>
            <p className="mx-5 border-t border-[#edf1f1] py-3 text-[11px] leading-relaxed text-[#84919d] dark:border-border dark:text-muted-foreground">Open the live workspace pages for registers, courses and absence requests.</p>
          </section>
        </div>
      </div>

      <Dialog open={timetableOpen} onOpenChange={setTimetableOpen}>
        <DialogContent className="flex max-h-[85dvh] max-w-3xl flex-col overflow-hidden border-[#dce6e7] bg-[#fefefd] p-0 dark:bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-[#e8eeee] px-5 py-4 dark:border-border">
            <div>
              <DialogHeader><DialogTitle className="text-lg font-bold text-[#1d3044] dark:text-foreground">My timetable</DialogTitle></DialogHeader>
              <p className="mt-0.5 text-xs text-[#81909c]">{fullName || "Account"} · Personal sessions</p>
            </div>
            {!timetableLoading && !timetableError && slots.length > 0 && (
              <button type="button" onClick={() => printTimetable(fullName, slots)} className="mr-8 inline-flex items-center gap-1.5 rounded-md border border-[#b8d8d2] px-3 py-1.5 text-xs font-semibold text-[#20786f] hover:bg-[#eaf6f2]" data-testid="button-print-timetable"><Printer size={14} /> Print</button>
            )}
          </div>
          <div className="overflow-auto p-5">
            {timetableLoading ? <div className="space-y-3" aria-label="Loading timetable">{[0, 1, 2].map(index => <div key={index} className="h-10 animate-pulse rounded bg-[#eaf1f2] dark:bg-muted" />)}</div>
              : timetableError ? <div className="py-8 text-center text-sm"><p>Timetable could not be loaded.</p><button type="button" onClick={() => refetchTimetable()} className="mt-2 font-semibold text-[#227e76] hover:underline" data-testid="button-retry-timetable">Try again</button></div>
                : slots.length === 0 ? <p className="py-10 text-center text-sm text-[#83919e]" data-testid="status-no-timetable">No personal timetable found for your account.</p>
                  : <div className="space-y-4">{days.map(day => {
                    const daySlots = slots.filter(slot => slot.day === day);
                    return <div key={day} className="border-b border-[#edf1f1] pb-3 last:border-0 dark:border-border">
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5a7180]">{day}</h3>
                      {daySlots.length ? daySlots.map(slot => <div key={slot.id} className="mb-1 flex flex-col gap-1 rounded-lg bg-[#f1f8f6] px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-4 dark:bg-muted" data-testid={`row-timetable-${slot.id}`}>
                        <span className="shrink-0 font-semibold text-[#287c75]">{slot.startTime ?? "Time not recorded"}{slot.endTime ? `–${slot.endTime}` : ""}</span>
                        <span className="font-medium text-[#263c4d] dark:text-foreground">{slot.description}</span>
                        {(slot.groupLabel || slot.room) && <span className="text-[#728391] sm:ml-auto">{[slot.groupLabel, slot.room].filter(Boolean).join(" · ")}</span>}
                      </div>) : <p className="text-xs text-[#9aa7b0]">No sessions recorded</p>}
                    </div>;
                  })}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}