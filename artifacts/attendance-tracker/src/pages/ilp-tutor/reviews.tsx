import { useMemo, useState } from "react";
import { Link } from "wouter";
import { RefreshCw } from "lucide-react";
import { IlpTutorNav } from "./_nav";
import { errorMessage, STATUS_LABEL, useTermlyFeed } from "@/hooks/use-termly";
import { StatusPill } from "@/components/termly/status-pill";

const FILTERS = ["all", "submitted", "draft", "not_started", "returned", "reviewed"];

export default function IlpTutorReviews() {
  const q = useTermlyFeed();
  const [filter, setFilter] = useState("submitted");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => (q.data?.reviews ?? []).filter((r) => (filter === "all" || r.status === filter) && r.studentName.toLowerCase().includes(search.toLowerCase())), [q.data, filter, search]);

  return (
    <div className="-mx-6 -mt-6 flex min-h-screen bg-slate-50">
      <IlpTutorNav active="Reviews" />
      <div className="min-w-0 flex-1 p-6">
        <h1 className="text-xl font-bold text-gray-900">Termly reviews</h1>
        <p className="mt-0.5 text-sm text-gray-500">Reviews for learners assigned to you as RG teacher. Open one to read, comment, complete or return it.</p>
        <div className="my-4 flex flex-wrap items-center gap-2">
          <input aria-label="Search learners" data-testid="input-search-reviews" placeholder="Search learner" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-56 rounded-md border border-slate-300 bg-white px-3 text-sm" />
          {FILTERS.map((f) => (
            <button key={f} type="button" data-testid={`filter-${f}`} onClick={() => setFilter(f)} className={`h-10 rounded-md border px-3 text-xs font-semibold ${filter === f ? "border-indigo-700 bg-indigo-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              {f === "all" ? "All" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        {q.isLoading && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-200/70" />)}</div>}
        {q.isError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4" role="alert">
            <p className="text-sm text-rose-900">{errorMessage(q.error)}</p>
            <button type="button" onClick={() => q.refetch()} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-rose-800 underline"><RefreshCw className="h-4 w-4" /> Try again</button>
          </div>
        )}
        {q.data && rows.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600" data-testid="empty-tutor-reviews">No reviews match. Learners assigned to you appear here once a term is published.</p>}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-3 py-2">Learner</th><th className="px-3 py-2">Term</th><th className="px-3 py-2">Target date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"><span className="sr-only">Open</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100" data-testid={`row-review-${r.id}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.studentName}</td>
                    <td className="px-3 py-2">{r.academicYear} T{r.term}</td>
                    <td className="px-3 py-2">{r.deadline}</td>
                    <td className="px-3 py-2"><StatusPill status={r.status} overdue={r.overdue} /></td>
                    <td className="px-3 py-2 text-right"><Link href={`/ilp-tutor/review/${r.id}`} data-testid={`link-open-review-${r.id}`} className="font-semibold text-indigo-700 hover:underline">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
