import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw, ShieldAlert } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { errorMessage, useTermlyReview } from "@/hooks/use-termly";
import { ReviewForm } from "./review-form";

export function ReviewLoader({ id, backHref, backLabel }: { id: number; backHref: string; backLabel: string }) {
  const role = useRole();
  const [reasonDraft, setReasonDraft] = useState("");
  const [reason, setReason] = useState<string | undefined>();
  const q = useTermlyReview(id, reason);
  const status = (q.error as { status?: number } | null)?.status;

  return (
    <div className="px-1 py-2" data-testid="page-termly-review">
      <Link href={backHref} className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-[#32776f] hover:underline" data-testid="link-back">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>
      {q.isLoading && (
        <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-200/70" />)}
        </div>
      )}
      {q.isError && role === "admin" && status === 403 && (
        <form className="mx-auto max-w-xl space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5" onSubmit={(e) => { e.preventDefault(); if (reasonDraft.trim().length >= 10) setReason(reasonDraft.trim()); }}>
          <p className="flex items-center gap-2 font-semibold text-amber-900"><ShieldAlert className="h-5 w-5" /> Support access to a private review</p>
          <p className="text-sm text-amber-900">You are not this learner's RG teacher. Discuss access with the learner and RG teacher first, then record a genuine support reason (at least 10 characters) to open a read-only copy. Your access is recorded.</p>
          <label htmlFor="support-reason" className="block text-xs font-semibold text-amber-900">Reason for access</label>
          <input id="support-reason" data-testid="input-support-reason" className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm" value={reasonDraft} onChange={(e) => setReasonDraft(e.target.value)} />
          <button type="submit" data-testid="button-open-support" disabled={reasonDraft.trim().length < 10} className="min-h-10 rounded-md bg-amber-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Open read-only</button>
          {reason && <p className="text-xs text-rose-700">{errorMessage(q.error)}</p>}
        </form>
      )}
      {q.isError && !(role === "admin" && status === 403 && !reason) && (
        <div className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-5" role="alert" data-testid="error-review">
          <p className="font-semibold text-rose-900">This review could not be opened.</p>
          <p className="mt-1 text-sm text-rose-800">{errorMessage(q.error)}</p>
          <button type="button" onClick={() => q.refetch()} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md bg-rose-700 px-4 text-sm font-semibold text-white" data-testid="button-retry"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      )}
      {q.data && <ReviewForm key={q.data.review.id} detail={q.data} mode={role === "learner" ? "learner" : q.data.supportReadOnly ? "support" : "tutor"} />}
    </div>
  );
}
