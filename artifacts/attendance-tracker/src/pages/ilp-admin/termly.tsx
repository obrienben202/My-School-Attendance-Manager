import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useMaintainTermlyIlps } from "@workspace/api-client-react";
import type { TermlyIlpCommandResult } from "@workspace/api-client-react";
import { CircleHelp, RefreshCw } from "lucide-react";
import { IlpAdminNav } from "./_nav";
import { useRole } from "@/hooks/use-role";
import { errorMessage, isConflict, STATUS_LABEL, useTermlyAdmin } from "@/hooks/use-termly";
import { TemplateEditor } from "@/components/termly/template-editor";
import { PeoplePanel } from "@/components/termly/people-panel";
import { CompletionMonitor } from "@/components/termly/completion-monitor";
import { Confirm, Field, ghostBtn, inputCls, primaryBtn } from "@/components/termly/admin-ui";
import { ILP_YEAR_GROUPS, matchesYearGroup } from "@/components/termly/year-groups";

const TABS = ["Overview", "Templates", "Terms", "People", "Help"] as const;
type Tab = (typeof TABS)[number];

export default function IlpAdminTermly() {
  const role = useRole();
  const q = useTermlyAdmin();
  const qc = useQueryClient();
  const mut = useMaintainTermlyIlps();
  const [tab, setTab] = useState<Tab>("Overview");
  const [yearGroup, setYearGroup] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ academicYear: "", term: "1", templateId: "", startDate: "", endDate: "", deadline: "" });
  const [preview, setPreview] = useState<TermlyIlpCommandResult | null>(null);
  const [confirmTerm, setConfirmTerm] = useState(false);

  function run(data: Record<string, unknown>, after?: (r: TermlyIlpCommandResult) => void) {
    setMsg(null);
    mut.mutate({ data: data as never }, {
      onSuccess: (r) => {
        setMsg({ ok: true, text: r.message });
        qc.invalidateQueries({ predicate: (k) => String(k.queryKey[0]).startsWith("/api/termly-ilps") });
        after?.(r);
      },
      onError: (e) => setMsg({ ok: false, text: isConflict(e) ? "This changed elsewhere. Reload the page to get the latest version; your edits on screen are untouched. " + errorMessage(e) : errorMessage(e) }),
    });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { not_started: 0, draft: 0, submitted: 0, reviewed: 0, returned: 0 };
    q.data?.reviews.filter(r => matchesYearGroup(r.yearGroup, yearGroup)).forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [q.data, yearGroup]);

  const visibleReviews = q.data?.reviews.filter(r => matchesYearGroup(r.yearGroup, yearGroup)) ?? [];
  const visibleLearners = q.data?.learners.filter(l => matchesYearGroup(l.yearGroup, yearGroup)) ?? [];

  if (role !== "admin") return <p className="p-6 text-sm text-slate-700" data-testid="text-admin-only">Only administrators can maintain termly ILPs.</p>;

  const termPayload = { academicYear: form.academicYear, term: Number(form.term), templateId: Number(form.templateId), startDate: form.startDate, endDate: form.endDate, deadline: form.deadline };
  const formReady = /^\d{4}-\d{4}$/.test(form.academicYear) && form.templateId && form.startDate && form.endDate && form.deadline;
  const set = (k: keyof typeof form, v: string) => { setForm({ ...form, [k]: v }); setPreview(null); };
  const published = q.data?.templates.filter((t) => t.status === "published") ?? [];

  return (
    <div className="-mx-6 -mt-6 flex min-h-screen bg-slate-50">
      <IlpAdminNav active="Termly ILPs" />
      <div className="min-w-0 flex-1 p-4 sm:p-6" data-testid="page-ilp-admin-termly">
        <h1 className="text-xl font-bold text-gray-900">Termly ILPs</h1>
        <p className="mt-0.5 text-sm text-gray-500">Maintain forms, open each term, link accounts and track completion.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">Year group
            <select className={`${inputCls} mt-1`} aria-label="Termly ILP year group" data-testid="filter-ilp-year-group" value={yearGroup} onChange={e => setYearGroup(e.target.value)}>
              <option value="">All year groups</option>
              {ILP_YEAR_GROUPS.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <Link className={primaryBtn} data-testid="button-staff-comments" href={`/termly-ilps/staff${yearGroup ? `?yearGroup=${encodeURIComponent(yearGroup)}` : ""}`}>Staff comments</Link>
        </div>
        <div role="tablist" className="my-4 flex flex-wrap gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} data-testid={`tab-${t.toLowerCase()}`} onClick={() => setTab(t)} className={`min-h-10 border-b-2 px-4 text-sm font-semibold ${tab === t ? "border-teal-700 text-teal-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}>{t}</button>
          ))}
        </div>
        {msg && <div role={msg.ok ? "status" : "alert"} data-testid={msg.ok ? "banner-success" : "banner-error"} className={`mb-4 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>{msg.text}</div>}

        {q.isLoading && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-slate-200/70" />)}</div>}
        {q.isError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4" role="alert">
            <p className="text-sm text-rose-900">{errorMessage(q.error)}</p>
            <button type="button" onClick={() => q.refetch()} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-rose-800 underline" data-testid="button-retry"><RefreshCw className="h-4 w-4" /> Try again</button>
          </div>
        )}

        {q.data && tab === "Overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(counts).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-200 bg-white p-3" data-testid={`count-${k}`}><p className="text-2xl font-bold text-slate-900">{v}</p><p className="text-xs text-slate-600">{STATUS_LABEL[k]}</p></div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="count-missing-accounts"><p className="text-2xl font-bold text-amber-900">{visibleLearners.filter((l) => !l.learnerUserId).length}</p><p className="text-xs text-amber-900">Learners with no linked account</p></div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="count-missing-tutors"><p className="text-2xl font-bold text-amber-900">{visibleLearners.filter((l) => !l.tutorUserId).length}</p><p className="text-xs text-amber-900">Learners with no RG teacher</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ghostBtn} data-testid="button-reconcile" disabled={mut.isPending} onClick={() => run({ action: "reconcile" })}>Create missing reviews for new learners</button>
              {q.data.templates.length === 0 && <button type="button" className={primaryBtn} data-testid="button-seed" disabled={mut.isPending} onClick={() => run({ action: "seed" })}>Seed Terms 1-3</button>}
            </div>
            <CompletionMonitor reviews={visibleReviews} />
            <p className="text-sm font-semibold text-slate-800">Terms published</p>
            {q.data.terms.length === 0 ? <p className="text-sm text-slate-600" data-testid="empty-terms">No term has been published yet. Use the Terms tab.</p> : (
              <ul className="text-sm text-slate-700">{q.data.terms.map((t) => <li key={t.id}>{t.academicYear} Term {t.term}: {t.startDate} to {t.endDate}, target date {t.deadline}</li>)}</ul>
            )}
          </div>
        )}

        {q.data && tab === "Templates" && <TemplateEditor templates={q.data.templates} run={run as never} busy={mut.isPending} selectedId={selectedId} onSelect={setSelectedId} />}

        {q.data && tab === "Terms" && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
              <Field label="Academic year (YYYY-YYYY)" htmlFor="term-year"><input id="term-year" data-testid="input-academic-year" placeholder="2025-2026" className={inputCls} value={form.academicYear} onChange={(e) => set("academicYear", e.target.value)} /></Field>
              <Field label="Term" htmlFor="term-no"><select id="term-no" data-testid="select-term" className={inputCls} value={form.term} onChange={(e) => set("term", e.target.value)}>{[1, 2, 3].map((n) => <option key={n} value={n}>Term {n}</option>)}</select></Field>
              <Field label="Template version" htmlFor="term-tpl"><select id="term-tpl" data-testid="select-term-template" className={inputCls} value={form.templateId} onChange={(e) => set("templateId", e.target.value)}><option value="">Choose a published version</option>{published.filter((t) => t.term === Number(form.term)).map((t) => <option key={t.id} value={t.id}>Term {t.term} v{t.version}</option>)}</select></Field>
              <Field label="Start date" htmlFor="term-start"><input id="term-start" type="date" data-testid="input-start-date" className={inputCls} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
              <Field label="End date" htmlFor="term-end"><input id="term-end" type="date" data-testid="input-end-date" className={inputCls} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
              <Field label="Deadline" htmlFor="term-deadline"><input id="term-deadline" type="date" data-testid="input-deadline" className={inputCls} value={form.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ghostBtn} data-testid="button-preview-term" disabled={!formReady || mut.isPending} onClick={() => run({ action: "preview_term", ...termPayload }, setPreview)}>Preview publication</button>
              <button type="button" className={primaryBtn} data-testid="button-publish-term" disabled={!formReady || !preview || mut.isPending} title={preview ? undefined : "Preview first"} onClick={() => setConfirmTerm(true)}>Publish term</button>
            </div>
            {preview && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm" data-testid="panel-term-preview">
                <p className="font-semibold">{preview.message}</p>
                <ul className="mt-1 list-disc pl-5 text-slate-700">
                  <li>{preview.totalLearners ?? 0} confirmed learners will each have one review</li>
                  <li>{preview.newReviews ?? 0} new reviews, {preview.existingReviews ?? 0} already exist and keep their work</li>
                  <li>{preview.missingAccounts ?? 0} without a linked account, {preview.missingTutors ?? 0} without an RG teacher</li>
                </ul>
              </div>
            )}
            {confirmTerm && (
              <Confirm title={`Publish ${form.academicYear} Term ${form.term} for all learners?`} confirmLabel="Publish for all learners" busy={mut.isPending} onCancel={() => setConfirmTerm(false)}
                onConfirm={() => run({ action: "publish_term", ...termPayload }, () => { setConfirmTerm(false); setPreview(null); })}>
                {preview?.newReviews ?? 0} new reviews will be created. Existing work is kept and nothing is duplicated.
              </Confirm>
            )}
          </div>
        )}

        {q.data && tab === "People" && <PeoplePanel data={{ ...q.data, learners: visibleLearners }} run={run as never} busy={mut.isPending} />}

        {tab === "Help" && (
          <div className="max-w-2xl space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700" data-testid="panel-help">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><CircleHelp className="h-4 w-4" /> Running a term</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>School account setup: the school must create individual verified accounts, add them to the school directory with role learner or student, then an administrator uses Admin → User Management → Sync from Google Sheet. The password service verifies credentials; it cannot assign roles. Learners never sign up themselves.</li>
              <li>ILP Admin → Termly ILPs → People: verify the account belongs to that learner against the authoritative school roster and exact person code, not a learner-supplied code or name alone. Choose the learner account and RG teacher, then select Save. Each account can link to only one confirmed learner.</li>
              <li>Templates tab: Clone as new draft version for next year, edit, Save template, then Publish version.</li>
              <li>Terms tab: enter year, term, template and dates, select Preview publication, then Publish term.</li>
              <li>Overview tab: watch the counts. ILP Tutor, Reviews is where RG teachers complete or return reviews.</li>
              <li>Use Year group to narrow monitoring and People to Year 7–11. Staff comments lets any signed-in school staff member add a separate note without opening private learner answers or replacing the RG teacher review.</li>
              <li>Next year: Clone the template if wording changes, then publish Term 1 for the new academic year. Earlier reviews stay as they are.</li>
            </ol>
            <p>The full click-by-click version is in the staff guide.</p>
          </div>
        )}
      </div>
    </div>
  );
}
