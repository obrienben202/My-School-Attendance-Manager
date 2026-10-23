import { Link } from "wouter";
import { CalendarClock, ChevronRight, CircleHelp, RefreshCw, UserX } from "lucide-react";
import { errorMessage, useTermlyFeed } from "@/hooks/use-termly";
import { StatusPill } from "@/components/termly/status-pill";

const STEPS = [
  "Open the review for the current term and read the welcome note.",
  "Answer in your own words. Choose Discuss with my RG teacher for anything you would rather talk through in person.",
  "Select Save draft whenever you stop. You can sign out and come back.",
  "Fill in the summary and your three targets, then select Submit to Tutor.",
];

export default function LearnerIlps() {
  const q = useTermlyFeed();
  return (
    <div className="mx-auto max-w-3xl px-1 py-4" data-testid="page-learner-ilps">
      <p className="text-xs font-bold uppercase tracking-widest text-[#32776f]">Termly review</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">My termly reviews</h1>
      <p className="mt-1 text-sm text-slate-600">A private space to reflect each term with your RG teacher.</p>

      {q.isLoading && <div className="mt-6 space-y-3" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200/70" />)}</div>}

      {q.isError && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-5" role="alert">
          <p className="font-semibold text-rose-900">Your reviews could not be loaded.</p>
          <p className="mt-1 text-sm text-rose-800">{errorMessage(q.error)}</p>
          <button type="button" data-testid="button-retry" onClick={() => q.refetch()} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md bg-rose-700 px-4 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      )}

      {q.data && !q.data.linked && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5" data-testid="panel-unlinked">
          <p className="flex items-center gap-2 font-semibold text-amber-900"><UserX className="h-5 w-5" /> Your account is not linked to a learner record yet</p>
          <p className="mt-2 text-sm text-amber-900">{q.data.guidance || "Your school administrator needs to link this account to your learner record before your reviews appear."}</p>
          <p className="mt-2 text-sm text-amber-900">Please tell your RG teacher or the school office that you signed in successfully but see this message. Quote your username. You do not need to do anything else.</p>
        </div>
      )}

      {q.data?.linked && (
        <>
          {q.data.guidance && <p className="mt-4 rounded-lg bg-[#e1efec] p-3 text-sm text-[#1f4f49]">{q.data.guidance}</p>}
          {q.data.reviews.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center" data-testid="empty-reviews">
              <CalendarClock className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 font-semibold text-slate-800">No reviews are open yet</p>
              <p className="text-sm text-slate-600">When a term is published, your review will appear here.</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {q.data.reviews.map((r) => (
                <li key={r.id}>
                  <Link href={`/termly-ilps/review/${r.id}`} data-testid={`link-review-${r.id}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-[#458980]">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{r.academicYear} - Term {r.term}</p>
                      <p className="text-xs text-slate-500">Opens {r.startDate}. Target date {r.deadline}.</p>
                      <div className="mt-1"><StatusPill status={r.status} overdue={r.overdue} /></div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5" data-testid="section-learner-guide">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><CircleHelp className="h-4 w-4 text-[#32776f]" /> How to complete your review</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">{STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="mt-3 text-xs text-slate-500">Only you and your RG teacher can read your answers.</p>
      </section>
    </div>
  );
}
