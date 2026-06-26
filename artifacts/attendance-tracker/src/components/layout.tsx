import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useRole, type Role } from "@/hooks/use-role";
import { 
  Home, 
  UserCircle, 
  BookOpen, 
  ClipboardList, 
  BookMarked, 
  PenTool, 
  Users, 
  AlertTriangle, 
  Target, 
  FileText, 
  Archive, 
  LifeBuoy, 
  PlusCircle,
  LogOut,
  LogIn,
  ClipboardCheck,
  ConciergeBell,
  TrendingUp,
  Layers,
  Star,
  LayoutGrid,
  CalendarOff,
  BarChart2,
  ShieldAlert,
  ShieldCheck,
  CalendarClock,
  ShieldPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarItem = {
  icon: React.ElementType;
  label: string;
  href: string;
  color?: string;
  roles?: Role[];
};

type SidebarSection = {
  heading: string;
  items: SidebarItem[];
  roles?: Role[];
};

const ALL_ROLES: Role[] = ["admin", "hod", "staff", "office"];
const ADMIN_HOD: Role[] = ["admin", "hod"];
const ADMIN_HOD_STAFF: Role[] = ["admin", "hod", "staff"];
const ADMIN_HOD_OFFICE: Role[] = ["admin", "hod", "office"];
const ADMIN_ONLY: Role[] = ["admin"];

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    heading: "Staff Portal",
    items: [
      { icon: Home, label: "My Homepage", href: "/" },
      { icon: UserCircle, label: "My Details", href: "/my-details" },
      { icon: BookOpen, label: "My Courses", href: "/courses" },
      { icon: ClipboardList, label: "eRegisters", href: "/attendance" },
      { icon: BookMarked, label: "Markbook", href: "/markbook", roles: ADMIN_HOD_STAFF },
      { icon: BookMarked, label: "Markbook Verification", href: "/markbook/verification", roles: ADMIN_HOD_STAFF },
      { icon: PenTool, label: "My Assessments", href: "/assessments", roles: ADMIN_HOD_STAFF },
      { icon: ClipboardCheck, label: "My Unconfirmed Assessments", href: "/assessments?unconfirmed=1", roles: ADMIN_HOD_STAFF },
      { icon: Users, label: "My Assignments / Groups", href: "/assignments-groups", roles: ADMIN_HOD_STAFF },
      { icon: AlertTriangle, label: "At Risk Learners", href: "/students?atRisk=true", color: "text-red-400", roles: ADMIN_HOD_OFFICE },
      { icon: Target, label: "Targets", href: "/targets", roles: ADMIN_HOD_OFFICE },
      { icon: FileText, label: "ILP", href: "/ilps", roles: ADMIN_HOD_STAFF },
      { icon: CalendarOff, label: "Planned Absence", href: "/planned-absence" },
      { icon: BarChart2, label: "Reports", href: "/reports", roles: ADMIN_HOD_OFFICE },
      { icon: CalendarClock, label: "Schedules", href: "/schedules", roles: ADMIN_HOD_OFFICE },
      { icon: Archive, label: "Old Markbook", href: "/licence-required?feature=old-markbook", roles: ADMIN_ONLY },
      { icon: LifeBuoy, label: "Support", href: "/licence-required?feature=support", roles: ADMIN_ONLY },
      { icon: PlusCircle, label: "New ILP", href: "/ilps/new", roles: ADMIN_HOD_STAFF },
    ],
  },
  {
    heading: "ILP Tutor",
    roles: ADMIN_HOD_STAFF,
    items: [
      { icon: LayoutGrid, label: "ILP Tutor", href: "/ilp-tutor" },
      { icon: Star, label: "Reviews", href: "/ilp-tutor/reviews" },
      { icon: Users, label: "Learner Search", href: "/ilp-tutor/learners" },
      { icon: BookOpen, label: "My Learners' ILPs", href: "/ilp-tutor/ilps" },
    ],
  },
  {
    heading: "ILP Admin",
    roles: ADMIN_HOD,
    items: [
      { icon: LayoutGrid, label: "ILP Admin", href: "/ilp-admin" },
      { icon: ClipboardList, label: "Assigned ILPs", href: "/ilp-admin/assigned" },
      { icon: Users, label: "Manage Learner ILPs", href: "/ilp-admin/learners" },
      { icon: FileText, label: "Headers", href: "/ilp-admin/headers" },
      { icon: Layers, label: "Groups", href: "/ilp-admin/groups" },
      { icon: Star, label: "Reviews", href: "/ilp-admin/reviews" },
      { icon: ClipboardCheck, label: "Sections", href: "/ilp-admin/sections" },
    ],
  },
  {
    heading: "Safeguarding",
    roles: ADMIN_HOD_STAFF,
    items: [
      { icon: ShieldAlert, label: "Safeguarding", href: "/safeguarding" },
      { icon: ShieldCheck, label: "Safeguarding Admin", href: "/safeguarding/admin", roles: ADMIN_HOD },
    ],
  },
  {
    heading: "eProgressions",
    roles: ADMIN_HOD_OFFICE,
    items: [
      { icon: TrendingUp, label: "eProgressions Hub", href: "/eprogressions" },
    ],
  },
  {
    heading: "Concierge",
    roles: ADMIN_HOD_OFFICE,
    items: [
      { icon: ConciergeBell, label: "Concierge", href: "/concierge" },
      { icon: Users, label: "Applicants", href: "/concierge/applicants" },
      { icon: FileText, label: "Applications", href: "/concierge/applications", roles: ADMIN_HOD },
      { icon: ClipboardCheck, label: "Interviews", href: "/concierge/interviews" },
      { icon: BookOpen, label: "Enrolments", href: "/concierge/enrolments" },
    ],
  },
  {
    heading: "Administration",
    roles: ADMIN_ONLY,
    items: [
      { icon: ShieldPlus, label: "User Management", href: "/admin/users" },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const role = useRole();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-10 flex flex-col items-center gap-6 max-w-sm w-full">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-xl">AT</div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-800">Attendance Tracker</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to access the staff portal</p>
          </div>
          <button
            onClick={login}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors w-full justify-center"
          >
            <LogIn className="w-4 h-4" />
            Log in
          </button>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    const hrefPath = href.split("?")[0];
    return location === hrefPath || location.startsWith(hrefPath + "/");
  };

  const ROLE_LABELS: Record<Role, string> = {
    admin: "Admin",
    hod: "Head of Dept",
    staff: "Staff",
    office: "Office Staff",
  };

  const ROLE_COLORS: Record<Role, string> = {
    admin: "bg-red-500/20 text-red-300",
    hod: "bg-purple-500/20 text-purple-300",
    staff: "bg-blue-500/20 text-blue-300",
    office: "bg-green-500/20 text-green-300",
  };

  const visibleSections = SIDEBAR_SECTIONS
    .filter((section) => !section.roles || section.roles.includes(role))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex-shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-white">AT</div>
            <span className="font-semibold text-lg tracking-tight">Attendance</span>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-4">
          {visibleSections.map((section) => (
            <div key={section.heading}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-2 mb-1">
                {section.heading}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors",
                        isActive(item.href)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        item.color,
                      )}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          {user && (
            <div className="flex items-center gap-2 mb-3">
              {(user as { profileImageUrl?: string }).profileImageUrl ? (
                <img
                  src={(user as { profileImageUrl?: string }).profileImageUrl}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {((user as { firstName?: string }).firstName?.[0] ?? "") +
                    ((user as { lastName?: string }).lastName?.[0] ?? "")}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">
                  {(user as { firstName?: string; lastName?: string }).firstName}{" "}
                  {(user as { firstName?: string; lastName?: string }).lastName}
                </p>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", ROLE_COLORS[role])}>
                  {ROLE_LABELS[role]}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors w-full px-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-6 overflow-auto">{children}</main>
    </div>
  );
}
