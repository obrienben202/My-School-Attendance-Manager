import { useLocation } from "wouter";
import { ClipboardList, Users, FileText, Layers, Star, Layout, LayoutGrid } from "lucide-react";

const NAV_ITEMS = [
  { label: "ILP Admin", href: "/ilp-admin", icon: LayoutGrid },
  { label: "Assigned ILPs", href: "/ilp-admin/assigned", icon: ClipboardList },
  { label: "Manage Learner ILPs", href: "/ilp-admin/learners", icon: Users },
  { label: "Headers", href: "/ilp-admin/headers", icon: FileText },
  { label: "Groups", href: "/ilp-admin/groups", icon: Layers },
  { label: "Reviews", href: "/ilp-admin/reviews", icon: Star },
  { label: "Sections", href: "/ilp-admin/sections", icon: Layout },
];

export function IlpAdminNav({ active }: { active: string }) {
  const [, navigate] = useLocation();
  return (
    <div className="w-48 shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-3 py-3 border-b border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ILP Admin</p>
      </div>
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
        <button
          key={label}
          onClick={() => navigate(href)}
          className={`w-full text-left text-xs px-4 py-2 border-b border-slate-100 transition-colors flex items-center gap-2 ${
            active === label
              ? "bg-teal-700 text-white font-semibold"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Icon className="w-3 h-3 shrink-0" /> {label}
        </button>
      ))}
    </div>
  );
}
