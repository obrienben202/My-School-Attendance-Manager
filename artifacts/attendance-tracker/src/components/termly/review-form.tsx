import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActOnTermlyIlpReview } from "@workspace/api-client-react";
import type { TermlyIlpDetail, TermlyIlpReview, TermlyIlpWork, TermlyIlpWorkTargetsItem } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Lock, RefreshCw, Save, Send, Undo2 } from "lucide-react";
import { errorMessage, isConflict } from "@/hooks/use-termly";
import { StatusPill } from "./status-pill";

export const DISCUSS_TEXT = "Discuss with my RG teacher";
const CATS = [
  { key: "academic", label: "Academic target" },
  { key: "personal", label: "Personal target" },
  { key: "future", label: "Future / skills target" },
] as const;
type Cat = (typeof CATS)[number]["key"];
export type FormMode = "learner" | "tutor" | "support";

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#458980] focus:outline-none focus:ring-2 focus:ring-[#458980]/30 disabled:bg-slate-50 disabled:text-slate-600";
const btn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function blankTargets(work: TermlyIlpWork): Record<Cat, TermlyIlpWorkTargetsItem> {
  const out = {} as Record<Cat, TermlyIlpWorkTargetsItem>;
  for (const c of CATS) {
    out[c.key] = work.targets.find((t) => t.category === c.key) ?? { category: c.key, description: "", steps: "", progress: "", completed: false };
  }
  return out;
}

export function ReviewForm({ detail, mode, onSaved }: { detail: TermlyIlpDetail; mode: FormMode; onSaved?: (r: TermlyIlpReview) => void }) {
  const { template, previousReviews } = detail;
  const qc = useQueryClient();
  const act = useActOnTermlyIlpReview();
  const initFor = useRef<string | null>(null);
  const [review, setReview] = useState(detail.review);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState("");
  const [targets, setTargets] = useState<Record<Cat, TermlyIlpWorkTargetsItem>>(() => blankTargets(detail.review.work));
  const [prior, setPrior] = useState<Record<string, { progress: string; completed: boolean }>>({});
  const [comment, setComment] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: "ok" | "error" | "conflict"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (initFor.current === String(detail.review.id)) return;
    initFor.current = String(detail.review.id);
    const r = detail.review;
    setReview(r);
    setAnswers({ ...r.work.answers });
    setSummary(r.work.summary);
    setTargets(blankTargets(r.work));
    setPrior({ ...r.work.priorTargetUpdates });
    setComment(r.teacherComment ?? "");
    setReviewDate(r.reviewDate ?? "");
  }, [detail]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const today = new Date().toISOString().slice(0, 10);
  const notOpen = today < review.startDate;
  const learnerEditable = mode === "learner" && !notOpen && ["not_started", "draft", "returned"].includes(review.status);
  const teacherEditable = mode === "tutor" && review.status === "submitted";
  const canDecide = mode === "tutor" && review.status === "submitted";
  const busy = act.isPending;

  const touch = () => { setDirty(true); setBanner(null); };

  const work = useMemo<TermlyIlpWork>(() => ({
    answers,
    summary,
    targets: CATS.map((c) => targets[c.key]),
    priorTargetUpdates: prior,
  }), [answers, summary, targets, prior]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    for (const s of template.content.sections) for (const q of s.questions) {
      if (q.required && !(answers[q.id] ?? "").trim()) e[`q:${q.id}`] = `Answer this question, or choose "${DISCUSS_TEXT}".`;
    }
    if (!summary.trim()) e.summary = "Write a short summary of your discussion.";
    for (const c of CATS) {
      if (!targets[c.key].description.trim()) e[`t:${c.key}:d`] = "Describe this target.";
      if (!targets[c.key].steps.trim()) e[`t:${c.key}:s`] = "List the steps you will take.";
    }
    setErrors(e);
    if (Object.keys(e).length) {
      setBanner({ kind: "error", text: `${Object.keys(e).length} item(s) need attention before you can submit.` });
      setTimeout(() => document.querySelector("[data-invalid='true']")?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
      return false;
    }
    return true;
  }

  function run(action: "save" | "submit" | "comment" | "complete" | "return") {
    setErrors({});
    if (action === "submit" && !validate()) return;
    if (action === "complete" && (!comment.trim() || !reviewDate)) {
      setBanner({ kind: "error", text: "Completing a review needs a teacher comment and a review date." });
      return;
    }
    if (action === "return" && !comment.trim()) {
      setBanner({ kind: "error", text: "Add a comment explaining what the learner should change before returning." });
      return;
    }
    const data = mode === "learner"
      ? { action, revision: review.revision, work }
      : { action, revision: review.revision, teacherComment: comment, reviewDate: reviewDate || null };
    act.mutate({ id: review.id, data }, {
      onSuccess: (r) => {
        setReview(r);
        setDirty(false);
        qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/termly-ilps"), refetchType: "none" });
        const msg: Record<string, string> = {
          save: "Draft saved. You can leave and come back to it.",
          submit: "Submitted to your RG teacher.",
          comment: "Comment saved.",
          complete: "Review completed.",
          return: "Returned to the learner for changes.",
        };
        setBanner({ kind: "ok", text: msg[action] });
        onSaved?.(r);
      },
      onError: (e) => {
        if (isConflict(e)) setBanner({ kind: "conflict", text: "This review changed somewhere else since you opened it. Your text is still here and has not been saved. Copy anything important, then reload to get the latest version." });
        else setBanner({ kind: "error", text: `Not saved: ${errorMessage(e)} Your text is still on this page.` });
      },
    });
  }

  const locked = !learnerEditable || busy;
  const err = (k: string) => errors[k] ? <p className="mt-1 text-xs font-medium text-rose-700" data-testid={`error-${k}`}>{errors[k]}</p> : null;
  const hasStatusNote = mode === "learner" && !learnerEditable;

  return (
    <fieldset disabled={busy} className="mx-auto min-w-0 w-full max-w-3xl space-y-6 pb-32" data-testid="termly-review-form">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#32776f]">{review.academicYear} - Term {review.term}</p>
          <StatusPill status={review.status} overdue={review.overdue} />
        </div>
        <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{template.content.title}</h1>
        {mode !== "learner" && <p className="mt-1 text-sm text-slate-600">Learner: <strong data-testid="text-learner-name">{review.studentName}</strong></p>}
        <p className="mt-1 text-xs text-slate-500">Opens {review.startDate}. Target date {review.deadline}. Late submissions are still accepted.</p>
        {template.content.welcome && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{template.content.welcome}</p>}
        {template.content.instructions && <p className="mt-3 whitespace-pre-line rounded-md bg-[#e1efec] p-3 text-sm leading-relaxed text-[#1f4f49]">{template.content.instructions}</p>}
      </header>

      {mode === "support" && <Note icon={<Lock className="h-4 w-4" />} text="Read-only support view. This access is audited." />}
      {notOpen && mode === "learner" && <Note icon={<Lock className="h-4 w-4" />} text={`This review opens on ${review.startDate}. You can read it now but not write yet.`} />}
      {hasStatusNote && !notOpen && <Note icon={<Lock className="h-4 w-4" />} text={review.status === "reviewed" ? "Your RG teacher has completed this review. It is now read-only." : "Submitted. Your RG teacher will review it. It is read-only unless they return it."} />}
      {review.status === "returned" && review.teacherComment && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" data-testid="text-returned-comment"><strong>Returned by your RG teacher:</strong> {review.teacherComment}</div>
      )}

      {previousReviews.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="section-earlier-reviews">
          <h2 className="text-base font-bold text-slate-900">Earlier terms</h2>
          <p className="text-xs text-slate-500">Update progress below. Updates are saved with this review and never change the earlier one.</p>
          <div className="mt-3 space-y-4">
            {previousReviews.map((p) => (
              <details key={p.id} className="rounded-lg border border-slate-200 p-3" open>
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">{p.academicYear} - Term {p.term}</summary>
                {p.work.summary && <p className="mt-2 whitespace-pre-line text-sm text-slate-700"><span className="font-semibold">Discussion summary:</span> {p.work.summary}</p>}
                {p.teacherComment && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Teacher comment:</span> {p.teacherComment}</p>}
                <div className="mt-3 space-y-3">
                  {p.work.targets.filter((t) => t.description.trim()).map((t) => {
                    const k = `${p.id}:${t.category}`;
                    const latestEarlierUpdate = [...previousReviews].sort((a, b) => b.term - a.term)
                      .find(earlier => earlier.term > p.term && earlier.work.priorTargetUpdates[k])?.work.priorTargetUpdates[k];
                    const cur = prior[k] ?? latestEarlierUpdate ?? { progress: t.progress, completed: t.completed };
                    return (
                      <div key={k} className="rounded-md bg-slate-50 p-3 text-sm">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t.category}</p>
                        <p className="text-slate-800">{t.description}</p>
                        {t.steps && <p className="mt-1 text-xs text-slate-600">Steps: {t.steps}</p>}
                        <label className="mt-2 block text-xs font-semibold text-slate-700" htmlFor={`prior-${k}`}>Progress so far</label>
                        <textarea id={`prior-${k}`} data-testid={`input-prior-progress-${k}`} className={field} rows={2} disabled={!learnerEditable} value={cur.progress}
                          onChange={(e) => { setPrior({ ...prior, [k]: { ...cur, progress: e.target.value } }); touch(); }} />
                        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" className="h-4 w-4" data-testid={`check-prior-complete-${k}`} disabled={!learnerEditable} checked={cur.completed}
                            onChange={(e) => { setPrior({ ...prior, [k]: { ...cur, completed: e.target.checked } }); touch(); }} />
                          Target completed
                        </label>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {template.content.sections.map((s) => (
        <section key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">{s.title}</h2>
          {s.instructions && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{s.instructions}</p>}
          <div className="mt-4 space-y-5">
            {s.questions.map((q, i) => (
              <div key={q.id} data-invalid={errors[`q:${q.id}`] ? "true" : undefined}>
                <label htmlFor={`q-${q.id}`} className="block text-sm font-medium text-slate-900">
                  {i + 1}. {q.prompt}{q.required && <span className="ml-1 text-rose-600" aria-label="required">*</span>}
                </label>
                <textarea id={`q-${q.id}`} data-testid={`input-answer-${q.id}`} rows={3} className={`${field} mt-1 ${errors[`q:${q.id}`] ? "border-rose-400" : ""}`} disabled={locked}
                  value={answers[q.id] ?? ""} onChange={(e) => { setAnswers({ ...answers, [q.id]: e.target.value }); touch(); }} />
                {!locked && (
                  <button type="button" data-testid={`button-discuss-${q.id}`} className="mt-1 text-xs font-semibold text-[#32776f] underline underline-offset-2"
                    onClick={() => { setAnswers({ ...answers, [q.id]: DISCUSS_TEXT }); touch(); }}>
                    {DISCUSS_TEXT}
                  </button>
                )}
                {err(`q:${q.id}`)}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-invalid={errors.summary ? "true" : undefined}>
        <h2 className="text-base font-bold text-slate-900">Summary of our discussion<span className="ml-1 text-rose-600">*</span></h2>
        <textarea data-testid="input-summary" rows={4} aria-label="Summary of our discussion" className={`${field} mt-2`} disabled={locked} value={summary}
          onChange={(e) => { setSummary(e.target.value); touch(); }} />
        {err("summary")}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Your targets for this term</h2>
        <div className="mt-3 space-y-5">
          {CATS.map((c) => (
            <div key={c.key} className="rounded-lg bg-slate-50 p-4" data-invalid={errors[`t:${c.key}:d`] || errors[`t:${c.key}:s`] ? "true" : undefined}>
              <h3 className="text-sm font-bold text-slate-800">{c.label}<span className="ml-1 text-rose-600">*</span></h3>
              <p className="text-xs text-slate-500">Example: {template.content.targetExamples[c.key]}</p>
              <label className="mt-2 block text-xs font-semibold text-slate-700" htmlFor={`t-${c.key}-d`}>Target</label>
              <textarea id={`t-${c.key}-d`} data-testid={`input-target-${c.key}`} rows={2} className={field} disabled={locked} value={targets[c.key].description}
                onChange={(e) => { setTargets({ ...targets, [c.key]: { ...targets[c.key], description: e.target.value } }); touch(); }} />
              {err(`t:${c.key}:d`)}
              <label className="mt-2 block text-xs font-semibold text-slate-700" htmlFor={`t-${c.key}-s`}>Steps I will take</label>
              <textarea id={`t-${c.key}-s`} data-testid={`input-steps-${c.key}`} rows={2} className={field} disabled={locked} value={targets[c.key].steps}
                onChange={(e) => { setTargets({ ...targets, [c.key]: { ...targets[c.key], steps: e.target.value } }); touch(); }} />
              {err(`t:${c.key}:s`)}
              <label className="mt-2 block text-xs font-semibold text-slate-700" htmlFor={`t-${c.key}-p`}>Progress (optional)</label>
              <textarea id={`t-${c.key}-p`} data-testid={`input-progress-${c.key}`} rows={2} className={field} disabled={locked} value={targets[c.key].progress}
                onChange={(e) => { setTargets({ ...targets, [c.key]: { ...targets[c.key], progress: e.target.value } }); touch(); }} />
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4" data-testid={`check-complete-${c.key}`} disabled={locked} checked={targets[c.key].completed}
                  onChange={(e) => { setTargets({ ...targets, [c.key]: { ...targets[c.key], completed: e.target.checked } }); touch(); }} />
                Target completed
              </label>
            </div>
          ))}
        </div>
      </section>

      {template.content.endGuidance && <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm">{template.content.endGuidance}</p>}

      {mode !== "learner" && (
        <section className="rounded-xl border border-[#458980]/40 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">RG teacher review</h2>
          <label className="mt-2 block text-xs font-semibold text-slate-700" htmlFor="teacher-comment">Teacher comment</label>
          <textarea id="teacher-comment" data-testid="input-teacher-comment" rows={4} className={field} disabled={!teacherEditable} value={comment}
            onChange={(e) => { setComment(e.target.value); touch(); }} />
          <label className="mt-2 block text-xs font-semibold text-slate-700" htmlFor="review-date">Review date</label>
          <input id="review-date" data-testid="input-review-date" type="date" className={`${field} max-w-48`} disabled={!teacherEditable} value={reviewDate}
            onChange={(e) => { setReviewDate(e.target.value); touch(); }} />
        </section>
      )}
      {mode === "learner" && review.teacherComment && review.status !== "returned" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="text-teacher-comment">
          <h2 className="text-base font-bold text-slate-900">RG teacher comment</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{review.teacherComment}</p>
          {review.reviewDate && <p className="mt-1 text-xs text-slate-500">Reviewed on {review.reviewDate}</p>}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {banner && (
            <div role={banner.kind === "ok" ? "status" : "alert"} data-testid={`banner-${banner.kind}`}
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${banner.kind === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
              {banner.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="flex-1">{banner.text}</span>
              {banner.kind === "conflict" && (
                <button type="button" data-testid="button-reload-review" className="inline-flex items-center gap-1 font-semibold underline" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-3 w-3" /> Reload
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {learnerEditable && (
              <>
                <button type="button" data-testid="button-save-draft" disabled={busy} onClick={() => run("save")} className={`${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
                  <Save className="h-4 w-4" /> {busy ? "Saving..." : "Save draft"}
                </button>
                <button type="button" data-testid="button-submit-review" disabled={busy} onClick={() => run("submit")} className={`${btn} bg-[#458980] text-white hover:bg-[#32776f]`}>
                  <Send className="h-4 w-4" /> Submit to Tutor
                </button>
              </>
            )}
            {teacherEditable && (
              <button type="button" data-testid="button-save-comment" disabled={busy} onClick={() => run("comment")} className={`${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
                <Save className="h-4 w-4" /> Save comment
              </button>
            )}
            {canDecide && (
              <>
                <button type="button" data-testid="button-complete-review" disabled={busy} onClick={() => run("complete")} className={`${btn} bg-[#458980] text-white hover:bg-[#32776f]`}>
                  <CheckCircle2 className="h-4 w-4" /> Complete review
                </button>
                <button type="button" data-testid="button-return-review" disabled={busy} onClick={() => run("return")} className={`${btn} border border-rose-300 bg-white text-rose-800 hover:bg-rose-50`}>
                  <Undo2 className="h-4 w-4" /> Return to learner
                </button>
              </>
            )}
            {!learnerEditable && !teacherEditable && !canDecide && <p className="py-2 text-xs text-slate-500">No actions available for this review right now.</p>}
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function Note({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{icon}{text}</div>;
}
