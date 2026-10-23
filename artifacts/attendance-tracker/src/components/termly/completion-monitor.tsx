import { useState } from "react";
import { Link } from "wouter";
import type { TermlyIlpReviewSummary } from "@workspace/api-client-react";
import { StatusPill } from "./status-pill";
import { inputCls } from "./admin-ui";

export function CompletionMonitor({ reviews }: { reviews: TermlyIlpReviewSummary[] }) {
  const [year, setYear] = useState("");
  const [term, setTerm] = useState("");
  const [state, setState] = useState("");
  const selected = reviews.filter(r => (!year || r.academicYear === year) && (!term || r.term === Number(term)));
  const outstanding = selected.filter(r => !["submitted", "reviewed"].includes(r.status));
  const rows = selected.filter(r => !state || (state === "overdue" ? r.overdue : state === "outstanding" ? !["submitted", "reviewed"].includes(r.status) : r.status === state));
  return <section className="space-y-3 rounded-lg border bg-white p-4">
    <h2 className="font-semibold">Completion monitor</h2>
    <div className="flex flex-wrap gap-3">
      <select aria-label="Monitor academic year" className={inputCls} value={year} onChange={e => setYear(e.target.value)}><option value="">All academic years</option>{[...new Set(reviews.map(r => r.academicYear))].map(y => <option key={y}>{y}</option>)}</select>
      <select aria-label="Monitor term" className={inputCls} value={term} onChange={e => setTerm(e.target.value)}><option value="">All terms</option>{[1, 2, 3].map(t => <option key={t} value={t}>Term {t}</option>)}</select>
      <select aria-label="Monitor status" className={inputCls} value={state} onChange={e => setState(e.target.value)}><option value="">All states</option><option value="outstanding">Outstanding</option><option value="overdue">Overdue</option><option value="not_started">Not started</option><option value="draft">In progress</option><option value="returned">Returned</option><option value="submitted">Submitted</option><option value="reviewed">Reviewed</option></select>
    </div>
    <p className="text-sm">{outstanding.length} outstanding · {selected.filter(r => r.overdue).length} overdue · {selected.filter(r => r.status === "submitted").length} submitted · {selected.filter(r => r.status === "reviewed").length} reviewed</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr><th className="p-2">Learner</th><th className="p-2">Year group</th><th className="p-2">Term</th><th className="p-2">Deadline</th><th className="p-2">Status</th><th className="p-2">Setup</th><th className="p-2">Staff</th><th className="p-2">Support</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id} className="border-t">
        <td className="p-2">{r.studentName}</td><td className="p-2">{r.yearGroup || "Not recorded"}</td><td className="p-2">{r.academicYear} Term {r.term}</td><td className="p-2">{r.deadline}</td><td className="p-2"><StatusPill status={r.status} overdue={r.overdue} /></td>
        <td className="p-2">{!r.accountLinked && <p>Awaiting account setup</p>}{!r.tutorAssigned && <p>Awaiting RG teacher</p>}{r.accountLinked && r.tutorAssigned && "Ready"}</td>
        <td className="p-2"><Link className="inline-flex rounded-md border px-3 py-1 font-medium text-teal-800" href={`/termly-ilps/staff?reviewId=${r.id}`}>Staff comments</Link></td>
        <td className="p-2"><Link className="underline" href={`/termly-ilps/review/${r.id}`}>Open with support reason</Link></td>
      </tr>)}</tbody>
    </table>{rows.length === 0 && <p className="p-2 text-sm">No reviews match these filters.</p>}</div>
    <p className="text-xs text-slate-600">Monitoring does not show private answers. Support access requires a recorded reason after discussion with the learner and RG teacher.</p>
  </section>;
}