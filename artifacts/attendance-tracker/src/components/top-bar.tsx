import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, CircleHelp, Moon, PanelLeftClose, PanelLeftOpen, Sun, UserCircle, LogOut } from "lucide-react";
import type { Role } from "@/hooks/use-role";
import { getHelpPath } from "@/lib/staff-help";
import { AttentionPopover } from "./attention-popover";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type User = {
  id?: string | number | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  profileImageUrl?: string | null;
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  hod: "Head of Dept",
  staff: "Staff",
  office: "Office Staff",
  learner: "Learner",
};

export function TopBar({
  user,
  role,
  page,
  theme,
  onToggleTheme,
  collapsed,
  onToggleSidebar,
  onLogout,
  mobileNavigation,
}: {
  user: User | null;
  role: Role;
  page: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
  mobileNavigation: ReactNode;
}) {
  const [location] = useLocation();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  const displayName = fullName || user?.username || "My account";
  const initials = (fullName
    ? `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`
    : displayName.slice(0, 2)).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex min-h-[68px] items-center gap-3 border-b border-border bg-card px-4 text-card-foreground shadow-sm sm:px-8">
      <div className="md:hidden">{mobileNavigation}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">Home / {page === "Attendance Dashboard" ? "Attendance" : page}</p>
        <p className="truncate text-base font-bold tracking-tight text-foreground sm:text-[22px]" title={page}>
          {page === "Attendance Dashboard" ? <><span className="sm:hidden">Dashboard</span><span className="hidden sm:inline">Attendance Dashboard</span></> : page}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-testid="button-toggle-sidebar"
          onClick={onToggleSidebar}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted md:inline-flex"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"}
          title={theme === "dark" ? "Use light mode" : "Use dark mode"}
          data-testid="button-toggle-theme"
          aria-pressed={theme === "dark"}
          onClick={onToggleTheme}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {role !== "learner" ? (
          <Link href={getHelpPath(location, role)} aria-label="Help" title="Help" data-testid="button-help" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted">
            <CircleHelp className="h-4 w-4" />
          </Link>
        ) : (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Help" title="Help" data-testid="button-help" className="hidden h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted sm:inline-flex">
              <CircleHelp className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 text-sm">
            <p className="font-semibold">Using the portal</p>
            <p className="mt-2 text-muted-foreground">Use the sidebar to move between pages. Open the bell for work that needs attention, or use My details in your account menu for your profile.</p>
          </PopoverContent>
        </Popover>
        )}
        <AttentionPopover role={role} userName={fullName} userId={String(user?.id ?? user?.username ?? displayName)} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="button-account-menu"
              aria-label={`Account menu for ${displayName}`}
              className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-1.5 pr-2.5 text-left shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {user?.profileImageUrl ? (
                <img alt="" src={user.profileImageUrl} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e1efec] text-xs font-bold text-[#32776f]">{initials}</span>
              )}
              <span className="hidden min-w-0 max-w-32 leading-tight lg:block">
                <span data-testid="text-account-name" className="block truncate text-sm font-semibold">{displayName}</span>
                <span className="block text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="min-w-0">
              <span className="block truncate">{displayName}</span>
              <span className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[role]}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/my-details" data-testid="link-my-account"><UserCircle className="mr-2 h-4 w-4" /> My details</Link>
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="button-sign-out" onSelect={onLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}