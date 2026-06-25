import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const SIDEBAR_ITEMS = [
  { icon: Home, label: "My Homepage", href: "/" },
  { icon: UserCircle, label: "My Details", href: "/students" },
  { icon: BookOpen, label: "My Courses", href: "/courses" },
  { icon: ClipboardList, label: "My Registers", href: "/attendance" },
  { icon: BookMarked, label: "Markbook", href: "#" },
  { icon: PenTool, label: "My Assessments", href: "#" },
  { icon: Users, label: "My Assignments / Groups", href: "#" },
  { icon: AlertTriangle, label: "At Risk Learners", href: "/students?atRisk=true", color: "text-red-400" },
  { icon: Target, label: "Targets", href: "/targets" },
  { icon: FileText, label: "ILP", href: "/ilps" },
  { icon: Archive, label: "Old Markbook", href: "#" },
  { icon: LifeBuoy, label: "Support", href: "#" },
  { icon: PlusCircle, label: "New ILP", href: "/ilps/new" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

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
        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-2">
            {SIDEBAR_ITEMS.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href) && !item.href.startsWith("#"));
              return (
                <li key={item.label}>
                  <Link href={item.href} className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}>
                    <item.icon className={cn("w-4 h-4", item.color)} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {/* User footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 mb-3">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                {(user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email ?? "Staff"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50">Staff Portal</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors w-full px-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
