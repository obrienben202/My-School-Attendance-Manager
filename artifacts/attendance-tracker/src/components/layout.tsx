import { Link, useLocation } from "wouter";
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
  PlusCircle
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
              )
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/50">
          Admin Portal v1.0
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
