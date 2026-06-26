import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Calendar, GraduationCap } from "lucide-react";

const sections = [
  {
    icon: Users,
    title: "Applicants",
    description: "Search for existing learners, invite new applicants, or apply for courses on their behalf.",
    href: "/concierge/applicants",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: FileText,
    title: "Applications",
    description: "Find and manage existing applications. Track progress through interview, requirements, and offers.",
    href: "/concierge/applications",
    color: "text-green-600 bg-green-50",
  },
  {
    icon: Calendar,
    title: "Interviews",
    description: "Find scheduled interviews, add learners to interview slots, and update interview status and notes.",
    href: "/concierge/interviews",
    color: "text-purple-600 bg-purple-50",
  },
  {
    icon: GraduationCap,
    title: "Enrolments",
    description: "Create enrolments directly or convert accepted applications. Manage child courses, fees, and agreements.",
    href: "/concierge/enrolments",
    color: "text-orange-600 bg-orange-50",
  },
];

export default function ConciergeIndex() {
  const [, setLocation] = useLocation();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Concierge</h1>
        <p className="text-gray-500 mt-1">
          Search for learners, manage applications and interviews, and enrol learners onto courses.
        </p>
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          <strong>Important:</strong> To use Concierge, you must have the appropriate roles (Concierge Manager).
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.href}
              className="cursor-pointer hover:shadow-md transition-shadow border-gray-200"
              onClick={() => setLocation(s.href)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${s.color}`}>
                    <Icon size={20} />
                  </div>
                  <CardTitle className="text-lg">{s.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-gray-600">{s.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
