import { useSearch } from "wouter";
import { ShieldAlert } from "lucide-react";

const FEATURE_LABELS: Record<string, { title: string; licence: string; description: string }> = {
  markbook: {
    title: "Markbook",
    licence: "EBS4Markbook",
    description: "The Markbook feature allows staff to record and manage learner grades and assessment results in a centralised gradebook view.",
  },
  "assignments-groups": {
    title: "My Assignments / Groups",
    licence: "EBS4Markbook",
    description: "The Assignments / Groups feature allows staff to manage learner group allocations and assignment tracking.",
  },
  "old-markbook": {
    title: "Old Markbook",
    licence: "EBS4Markbook",
    description: "The legacy Markbook view for historical grade data. Requires the EBS4Markbook licence.",
  },
  support: {
    title: "Support",
    licence: "Support Portal",
    description: "The Support portal provides access to help articles and ticket submission.",
  },
};

export default function LicenceRequired() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const feature = params.get("feature") ?? "markbook";
  const info = FEATURE_LABELS[feature] ?? FEATURE_LABELS["markbook"];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-md w-full bg-white border border-amber-200 rounded-xl shadow-sm p-8 flex flex-col items-center gap-5 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-amber-500" />
        </div>

        <div>
          <h1 className="text-lg font-bold text-slate-800">{info.title}</h1>
          <p className="mt-1 text-sm text-amber-700 font-medium">
            An <span className="font-semibold">{info.licence}</span> licence must be held to display this option.
          </p>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">{info.description}</p>

        <div className="w-full border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            Please contact your system administrator or Tribal Group support to enquire about obtaining the required licence.
          </p>
        </div>
      </div>
    </div>
  );
}
