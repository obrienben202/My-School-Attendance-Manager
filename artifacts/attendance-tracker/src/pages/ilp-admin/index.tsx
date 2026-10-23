import { useLocation } from "wouter";
import { ClipboardList, Users, FileText, Layers, Star, BookOpen } from "lucide-react";

const SECTIONS = [
  {
    label: "Assigned ILPs",
    icon: ClipboardList,
    href: "/ilp-admin/assigned",
    description: "View and manage ILPs that have been assigned to learners. Assign new ILPs or unassign existing ones.",
    color: "bg-teal-50 border-teal-200 text-teal-700",
  },
  {
    label: "Manage Learner ILPs",
    icon: Users,
    href: "/ilp-admin/learners",
    description: "Search for learners by name or cohort filters to view and manage their Individual Learning Plans.",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    label: "Headers",
    icon: FileText,
    href: "/ilp-admin/headers",
    description: "Create, edit and delete ILP headers. Headers structure the ILP template shown to learners and tutors.",
    color: "bg-indigo-50 border-indigo-200 text-indigo-700",
  },
  {
    label: "Groups",
    icon: Layers,
    href: "/ilp-admin/groups",
    description: "Define learner groups using filter criteria. Groups determine which learners an ILP is applicable to.",
    color: "bg-violet-50 border-violet-200 text-violet-700",
  },
  {
    label: "Termly ILPs",
    icon: Star,
    href: "/ilp-admin/termly",
    description: "Edit termly learner review forms, publish terms, link learner accounts, assign RG teachers and monitor completion.",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
];

export default function IlpAdminHub() {
  const [, navigate] = useLocation();
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">ILP Admin</h1>
          <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 border border-teal-200 rounded font-medium">
            Licence: TribalILP
          </span>
        </div>
        <p className="text-gray-500 text-sm">
          Use the ILP Admin screen to create Individual Learning Plans, manage reviews, define learner groups, and assign ILPs to learners.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map(({ label, icon: Icon, href, description, color }) => (
          <button
            key={label}
            onClick={() => navigate(href)}
            className={`border rounded-lg p-5 text-left hover:shadow-md transition-all group ${color}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={18} />
              <span className="font-semibold text-sm">{label}</span>
            </div>
            <p className="text-xs opacity-80 leading-relaxed">{description}</p>
            <div className="mt-3 text-xs font-medium underline opacity-70 group-hover:opacity-100">
              Open →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
