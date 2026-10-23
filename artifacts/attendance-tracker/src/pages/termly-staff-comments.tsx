import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetTermlyIlpStaffFeedQueryKey,
  useAddTermlyIlpStaffComment,
  type TermlyIlpStaffComment,
  type TermlyIlpStaffFeed,
  type TermlyIlpStaffReview,
} from "@workspace/api-client-react";
import { errorMessage, useTermlyStaffFeed } from "@/hooks/use-termly";
import { StatusPill } from "@/components/termly/status-pill";
import { ILP_YEAR_GROUPS, matchesYearGroup } from "@/components/termly/year-groups";
import { ghostBtn, inputCls, primaryBtn } from "@/components/termly/admin-ui";

const MAX = 5000;
const STAFF_ROLES = ["admin", "hod", "staff", "office"];

function fmt(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function TermlyStaffComments() {
  const { user } = useAuth();
  const role = (user as { role?: string } | null)?.role;
  const who = String((user as { id?: string | number } | null)?.id ?? "anon");
  const qc = useQueryClient();
  const feed = useTermlyStaffFeed();
  const add = useAddTermlyIlpStaffComment();

  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [year, setYear] = useState(() => {
    const y = params.get("yearGroup") ?? "";
    return ILP_YEAR_GROUPS.includes(y) ? y : "";
  });
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [linkHandled, setLinkHandled] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const reviews = useMemo<TermlyIlpStaffReview[]>(() => feed.data?.reviews ?? [], [feed.data]);
  const years = useMemo(() => [...new Set(reviews.map(r => r.academicYear))], [reviews]);
  const rows = useMemo(
    () => reviews.filter(r => matchesYearGroup(r.yearGroup, year) && (!academicYear || r.academicYear === academicYear) && (!term || r.term === Number(term))),
    [reviews, year, academicYear, term],
  );

  useEffect(() => {
    setDrafts({});
    setSelectedId(null);
    setError("");
    setSaved("");
    setLinkHandled(false);
  }, [who]);

  useEffect(() => {
    if (linkHandled || !feed.data) return;
    setLinkHandled(true);
    const id = Number(params.get("reviewId"));
    if (id > 0 && feed.data.reviews.some(r => r.id === id)) setSelectedId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.data, linkHandled, who]);

  const selected = rows.find(r => r.id === selectedId) ?? null;
  const draft = selected ? drafts[selected.id] ?? "" : "";
  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX;

  function submit() {
    if (!selected || add.isPending || !trimmed || tooLong) return;
    const id = selected.id;
    setError("");
    setSaved("");
    add.mutate({ id, data: { text: trimmed } }, {
      onSuccess: (comment: TermlyIlpStaffComment) => {
        setDrafts(d => { const n = { ...d }; delete n[id]; return n; });
        setSaved("Comment saved.");
        qc.setQueryData<TermlyIlpStaffFeed>([...getGetTermlyIlpStaffFeedQueryKey(), who], old =>
          old ? { ...old, reviews: old.reviews.map(r => (r.id === id ? { ...r, comments: [...r.comments, comment] } : r)) } : old);
        qc.invalidateQueries({ queryKey: getGetTermlyIlpStaffFeedQueryKey() });
      },
      onError: e => setError(errorMessage(e)),
    });
  }

  if (role && !STAFF_ROLES.includes(role)) {
    return <div className="p-6"><p className="rounded-lg border bg-white p-4 text-sm" data-testid="text-staff-denied">This page is for school staff only.</p></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Staff comments on termly reviews</h1>
        <p className="text-sm text-slate-600">Comments here are visible to school staff only. They are separate from the RG teacher review, and learners' private work is not shown.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select aria-label="Year group" data-testid="select-year-group" className={`${inputCls} sm:w-44`} disabled={add.isPending} value={year} onChange={e => { setYear(e.target.value); setSaved(""); setError(""); }}>
          <option value="">All year groups</option>{ILP_YEAR_GROUPS.map(y => <option key={y}>{y}</option>)}
        </select>
        <select aria-label="Academic year" data-testid="select-academic-year" className={`${inputCls} sm:w-44`} disabled={add.isPending} value={academicYear} onChange={e => { setAcademicYear(e.target.value); setSaved(""); setError(""); }}>
          <option value="">All academic years</option>{years.map(y => <option key={y}>{y}</option>)}
        </select>
        <select aria-label="Term" data-testid="select-term" className={`${inputCls} sm:w-36`} disabled={add.isPending} value={term} onChange={e => { setTerm(e.target.value); setSaved(""); setError(""); }}>
          <option value="">All terms</option>{[1, 2, 3].map(t => <option key={t} value={t}>Term {t}</option>)}
        </select>
      </div>

      {feed.isLoading ? (
        <div className="space-y-2" data-testid="loading-staff-feed">{[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-200" />)}</div>
      ) : feed.isError ? (
        <div role="alert" className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{errorMessage(feed.error)}</p>
          <button type="button" className={ghostBtn} data-testid="button-retry-feed" onClick={() => feed.refetch()}>Try again</button>
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-lg border bg-white p-6 text-sm text-slate-700" data-testid="text-empty-feed">No termly reviews have been published yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className="rounded-lg border bg-white">
            <ul className="max-h-[70vh] divide-y overflow-y-auto" data-testid="list-reviews">
              {rows.map(r => (
                <li key={r.id}>
                  <button type="button" disabled={add.isPending} data-testid={`button-review-${r.id}`} aria-current={r.id === selectedId} onClick={() => { setSelectedId(r.id); setError(""); setSaved(""); }}
                    className={`w-full space-y-1 p-3 text-left hover:bg-slate-50 ${r.id === selectedId ? "bg-teal-50" : ""}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{r.studentName}</span>
                      <span className="text-xs text-slate-600">{r.comments.length} comment{r.comments.length === 1 ? "" : "s"}</span>
                    </span>
                    <span className="block text-xs text-slate-600">{r.yearGroup ?? "No year group"} · {r.academicYear} Term {r.term}</span>
                    <StatusPill status={r.status} overdue={r.overdue} />
                  </button>
                </li>
              ))}
            </ul>
            {rows.length === 0 && <p className="p-4 text-sm" data-testid="text-no-match">No reviews match these filters.</p>}
          </section>

          <section className="rounded-lg border bg-white p-4" data-testid="panel-review">
            {!selected ? (
              <p className="text-sm text-slate-600">Select a learner review to read and add staff comments.</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">{selected.studentName}</h2>
                  <p className="text-sm text-slate-600">{selected.yearGroup ?? "No year group"} · {selected.academicYear} Term {selected.term} · Deadline {selected.deadline}</p>
                  <StatusPill status={selected.status} overdue={selected.overdue} />
                  {(!selected.accountLinked || !selected.tutorAssigned) && (
                    <p className="text-xs text-slate-600">{!selected.accountLinked && "Awaiting account setup. "}{!selected.tutorAssigned && "Awaiting RG teacher."}</p>
                  )}
                </div>
                <ul className="space-y-2" data-testid="list-comments">
                  {selected.comments.map((c, i) => (
                    <li key={`${c.createdAt}-${i}`} className="rounded-md border bg-slate-50 p-3 text-sm" data-testid={`comment-${selected.id}-${i}`}>
                      <p className="whitespace-pre-wrap break-words">{c.text}</p>
                      <p className="mt-1 text-xs text-slate-600">{c.authorName} · {fmt(c.createdAt)}</p>
                    </li>
                  ))}
                  {selected.comments.length === 0 && <li className="text-sm text-slate-600">No staff comments yet.</li>}
                </ul>
                <form className="space-y-2" onSubmit={e => { e.preventDefault(); submit(); }}>
                  <label htmlFor="staff-comment" className="text-sm font-medium">Add a staff comment</label>
                  <textarea id="staff-comment" data-testid="input-staff-comment" rows={4} className={inputCls} value={draft} disabled={add.isPending}
                    onChange={e => { const v = e.target.value; setDrafts(d => ({ ...d, [selected.id]: v })); setSaved(""); }} />
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className={tooLong ? "text-rose-700" : ""}>{trimmed.length}/{MAX}</span>
                  </div>
                  {tooLong && <p role="alert" className="text-sm text-rose-700">Comments can be at most {MAX} characters.</p>}
                  {error && <p role="alert" data-testid="text-comment-error" className="text-sm text-rose-700">{error} Your draft has been kept.</p>}
                  {saved && <p role="status" data-testid="text-comment-saved" className="text-sm text-emerald-700">{saved}</p>}
                  <button type="submit" data-testid="button-save-comment" className={primaryBtn} disabled={add.isPending || !trimmed || tooLong}>
                    {add.isPending ? "Saving..." : "Save comment"}
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
