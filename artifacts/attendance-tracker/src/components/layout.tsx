import { useEffect, useState } from "react";
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
  Database,
  LayoutDashboard,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/top-bar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type SidebarItem = {
  icon: React.ElementType;
  label: string;
  href: string;
  newTab?: boolean;
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
    heading: "",
    items: [
      { icon: Home, label: "Dashboard", href: "/" },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { icon: BookOpen, label: "My Courses", href: "/courses" },
      { icon: ClipboardList, label: "eRegisters", href: "/attendance" },
      { icon: BookMarked, label: "Markbook", href: "/markbook", roles: ADMIN_HOD_STAFF },
      { icon: BookMarked, label: "Markbook Verification", href: "/markbook/verification", roles: ADMIN_HOD_STAFF },
      { icon: PenTool, label: "My Assessments", href: "/assessments", roles: ADMIN_HOD_STAFF },
      { icon: ClipboardCheck, label: "My Unconfirmed Assessments", href: "/assessments?unconfirmed=1", roles: ADMIN_HOD_STAFF },
      { icon: Users, label: "My Assignments / Groups", href: "/assignments-groups", roles: ADMIN_HOD_STAFF },
    ],
  },
  {
    heading: "Learner tools",
    items: [
      { icon: AlertTriangle, label: "At Risk Learners", href: "/students?atRisk=true", color: "text-red-400", roles: ADMIN_HOD_OFFICE },
      { icon: Target, label: "Targets", href: "/targets", roles: ADMIN_HOD_OFFICE },
      { icon: FileText, label: "ILP", href: "/ilps", roles: ADMIN_HOD_STAFF },
      { icon: CalendarOff, label: "Planned Absence", href: "/planned-absence" },
      { icon: BarChart2, label: "Reports", href: "/reports", roles: ADMIN_HOD_OFFICE },
      { icon: CalendarClock, label: "Schedules", href: "/schedules", roles: ADMIN_HOD_OFFICE },
      { icon: Archive, label: "Old Markbook", href: "/licence-required?feature=old-markbook", roles: ADMIN_HOD },
      { icon: LifeBuoy, label: "Support", href: "/licence-required?feature=support", roles: ADMIN_HOD },
      { icon: PlusCircle, label: "New ILP", href: "/ilps/new", roles: ADMIN_HOD_STAFF },
    ],
  },
  {
    heading: "ILP Tutor",
    roles: ALL_ROLES,
    items: [
      { icon: LayoutGrid, label: "ILP Tutor", href: "/ilp-tutor", roles: ADMIN_HOD_STAFF },
      { icon: Star, label: "Reviews", href: "/ilp-tutor/reviews", roles: ADMIN_HOD_STAFF },
      { icon: Users, label: "Learner Search", href: "/ilp-tutor/learners", roles: ADMIN_HOD_STAFF },
      { icon: BookOpen, label: "My Learners' ILPs", href: "/ilp-tutor/ilps", roles: ADMIN_HOD_STAFF },
      { icon: ClipboardList, label: "Staff ILP comments", href: "/termly-ilps/staff" },
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
      { icon: Star, label: "Termly ILPs", href: "/ilp-admin/termly", roles: ADMIN_ONLY },
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
    roles: ADMIN_HOD,
    items: [
      { icon: LayoutDashboard, label: "Department Timetable", href: "/hod/timetable", roles: ADMIN_HOD },
      { icon: ShieldPlus, label: "User Management", href: "/admin/users" },
      { icon: Database, label: "Data Sync", href: "/admin/sync" },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated, logout, refetch } = useAuth();
  const role = useRole();

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.localStorage.getItem("attendance-theme") === "dark" ? "dark" : "light",
  );
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(window.localStorage.getItem("attendance-sidebar-width"));
    return saved >= 184 && saved <= 360 ? saved : 192;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    window.localStorage.getItem("attendance-sidebar-collapsed") === "true",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("attendance-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("attendance-sidebar-width", String(sidebarWidth));
    window.localStorage.setItem("attendance-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarWidth, sidebarCollapsed]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      });
      if (res.ok) {
        refetch();
      } else {
        const data = await res.json() as { error?: string };
        setLoginError(data.error ?? "Invalid username or password");
      }
    } catch {
      setLoginError("Could not connect to the server. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6 max-w-sm w-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center font-bold text-white text-2xl shadow-lg">AT</div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">School Portal</h1>
              <p className="text-sm text-slate-400 mt-1">Sign in with your school username</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Username</label>
              <input
                type="text"
                autoComplete="username"
                autoFocus
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="e.g. maths"
                className="bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loginLoading}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Your password"
                className="bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loginLoading}
              />
            </div>
            {loginError && (
              <p className="text-red-400 text-xs text-center bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={loginLoading || !loginUsername || !loginPassword}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors mt-1"
            >
              <LogIn className="w-4 h-4" />
              {loginLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (role === "learner") {
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "Learner";
    return (
      <div className="min-h-[100dvh] bg-[#f4f7f6]">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-border bg-card px-4 sm:px-8" data-testid="learner-header">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#458980] text-[11px] font-bold text-white">AT</div>
          <Link href="/learner-ilps" className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight">My termly reviews</Link>
          <span className="hidden truncate text-xs text-muted-foreground sm:block" data-testid="text-learner-name">{name}</span>
          <button type="button" onClick={logout} data-testid="button-learner-logout" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </header>
        <main className="p-4 sm:px-8">{children}</main>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    const hrefPath = href.split("?")[0];
    return location === hrefPath || location.startsWith(hrefPath + "/");
  };

  const visibleSections = SIDEBAR_SECTIONS
    .filter((section) => !section.roles || section.roles.includes(role))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

  const renderNavigation = (closeOnNavigate = false) => (
    <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
      {visibleSections.map((section) => (
        <div key={section.heading}>
          {section.heading && <p className={cn("mb-2 mt-1 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/60", sidebarCollapsed && !closeOnNavigate && "sr-only")}>
            {section.heading}
          </p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                {closeOnNavigate ? (
                  <SheetClose asChild>
                    <Link
                      href={item.href}
                      target={item.newTab ? "_blank" : undefined}
                      rel={item.newTab ? "noopener noreferrer" : undefined}
                      className={cn(
                         "flex items-start gap-2.5 rounded-md px-2.5 py-2 text-[13px] leading-snug transition-colors",
                        isActive(item.href)
                           ? "bg-[#458980] font-semibold text-white"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        item.color,
                      )}
                      aria-current={isActive(item.href) ? "page" : undefined}
                    >
                       <item.icon className="mt-0.5 w-4 h-4 flex-shrink-0" />
                       <span>{item.label}</span>
                    </Link>
                  </SheetClose>
                ) : (
                  <Link
                    href={item.href}
                    target={item.newTab ? "_blank" : undefined}
                    rel={item.newTab ? "noopener noreferrer" : undefined}
                     title={sidebarCollapsed ? item.label : undefined}
                     aria-label={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                       "flex items-start gap-2.5 rounded-md px-2.5 py-2 text-[13px] leading-snug transition-colors",
                       sidebarCollapsed && "justify-center px-2",
                      isActive(item.href)
                         ? "bg-[#458980] font-semibold text-white"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      item.color,
                    )}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                     <item.icon className="mt-0.5 w-4 h-4 flex-shrink-0" />
                     <span className={cn(sidebarCollapsed && "sr-only")}>{item.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <div className="sticky top-0 hidden h-screen flex-shrink-0 md:flex" style={{ width: sidebarCollapsed ? 68 : sidebarWidth }}>
        <aside className="flex min-w-0 flex-1 flex-col bg-sidebar text-sidebar-foreground">
        <div className={cn("border-b border-sidebar-border px-3.5 py-4", sidebarCollapsed && "px-4")}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#458980] text-[11px] font-bold text-white">AT</div>
            {!sidebarCollapsed && <span className="min-w-0 leading-tight"><strong className="block text-[13px] tracking-tight">Attendance</strong><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/55">Learning hub</span></span>}
          </div>
        </div>

        {renderNavigation()}
        </aside>
        {!sidebarCollapsed && (
          <div
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            aria-valuemin={184}
            aria-valuemax={360}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            title="Drag to resize sidebar, or use arrow keys"
            data-testid="handle-resize-sidebar"
            className="w-1.5 cursor-col-resize bg-sidebar-border/50 transition-colors hover:bg-[#458980] focus:bg-[#458980] focus:outline-none"
            onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                setSidebarWidth(Math.max(184, Math.min(360, event.clientX)));
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                setSidebarWidth((current) => Math.max(184, Math.min(360, current + (event.key === "ArrowRight" ? 16 : -16))));
              }
            }}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={user}
          role={role}
          page={location === "/" ? "Attendance Dashboard" : location === "/my-details" ? "My Details" : visibleSections.flatMap((section) => section.items).filter((item) => isActive(item.href)).sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "Attendance"}
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")}
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          onLogout={logout}
          mobileNavigation={<Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open navigation menu"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded border border-border text-foreground transition-colors hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(18rem,85vw)] overflow-hidden bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Attendance navigation</SheetTitle>
              <SheetDescription>Open a section of the staff portal.</SheetDescription>
            </SheetHeader>
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-sidebar-border p-4">
                <div className="flex items-center gap-2">
                   <div className="flex h-8 w-8 items-center justify-center rounded bg-[#458980] font-bold text-white">AT</div>
                  <span className="font-semibold text-lg tracking-tight">Attendance</span>
                </div>
              </div>
              {renderNavigation(true)}
              <div className="border-t border-sidebar-border p-4">
                <button
                  onClick={logout}
                  className="flex min-h-10 w-full items-center gap-2 px-1 text-left text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>}
        />

      {/* Main content */}
        <main className="min-w-0 flex-1 overflow-auto p-4 sm:px-8 sm:py-4">{children}</main>
      </div>
    </div>
  );
}
