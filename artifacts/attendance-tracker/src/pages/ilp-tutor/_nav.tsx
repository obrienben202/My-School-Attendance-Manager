import { useLocation } from "wouter";
import { LayoutGrid, Star, Users, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { label: "ILP Tutor", href: "/ilp-tutor", icon: LayoutGrid },
  { label: "Reviews", href: "/ilp-tutor/reviews", icon: Star },
  { label: "Learner Search", href: "/ilp-tutor/learners", icon: Users },
  { label: "My Learners' ILPs", href: "/ilp-tutor/ilps", icon: BookOpen },
];

export function IlpTutorNav({ active }: { active: string }) {
  const [, navigate] = useLocation();
  return (
    <div className="w-48 shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-3 py-3 border-b border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ILP Tutor</p>
      </div>
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
        <button
          key={label}
          onClick={() => navigate(href)}
          className={`w-full text-left text-xs px-4 py-2 border-b border-slate-100 transition-colors flex items-center gap-2 ${
            active === label
              ? "bg-indigo-700 text-white font-semibold"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Icon className="w-3 h-3 shrink-0" /> {label}
        </button>
      ))}
    </div>
  );
}
