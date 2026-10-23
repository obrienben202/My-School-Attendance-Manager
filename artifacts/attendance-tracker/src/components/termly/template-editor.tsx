import { useEffect, useRef, useState } from "react";
import type { TermlyIlpTemplate, TermlyIlpTemplateContent } from "@workspace/api-client-react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Save, Send, Trash2 } from "lucide-react";
import { Confirm, Field, ghostBtn, inputCls, primaryBtn } from "./admin-ui";

type Cmd = (data: Record<string, unknown>, after?: (r: { templateId?: number }) => void) => void;
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export function TemplateEditor({ templates, run, busy, onSelect, selectedId }: { templates: TermlyIlpTemplate[]; run: Cmd; busy: boolean; onSelect: (id: number) => void; selectedId: number | null }) {
  const tpl = templates.find((t) => t.id === selectedId) ?? templates[0];
  const [content, setContent] = useState<TermlyIlpTemplateContent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmPub, setConfirmPub] = useState(false);
  const [baseRevision, setBaseRevision] = useState(0);
  const loaded = useRef<number | null>(null);

  useEffect(() => {
    if (tpl && (loaded.current !== tpl.id || (!dirty && tpl.revision !== baseRevision))) {
      loaded.current = tpl.id;
      setContent(structuredClone(tpl.content));
      setDirty(false);
      setPreview(false);
      setBaseRevision(tpl.revision);
    }
  }, [tpl, dirty, baseRevision]);

  if (!tpl || !content) return <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600" data-testid="empty-templates">No templates yet. Use Seed Terms 1-3 on the Overview tab.</p>;
  const draft = tpl.status === "draft";
  const set = (c: TermlyIlpTemplateContent) => { setContent(c); setDirty(true); };
  const sec = (i: number, patch: Partial<TermlyIlpTemplateContent["sections"][number]>) => set({ ...content, sections: content.sections.map((s, k) => k === i ? { ...s, ...patch } : s) });

  return (
    <div className="space-y-4" data-testid="template-editor">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Template" htmlFor="tpl-select">
          <select id="tpl-select" data-testid="select-template" className={inputCls} value={tpl.id} onChange={(e) => { if (!dirty || window.confirm("Discard unsaved edits to this template?")) onSelect(Number(e.target.value)); }}>
            {templates.map((t) => <option key={t.id} value={t.id}>Term {t.term} - version {t.version} ({t.status})</option>)}
          </select>
        </Field>
        <button type="button" className={ghostBtn} data-testid="button-toggle-preview" onClick={() => setPreview(!preview)}>{preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {preview ? "Back to editing" : "Preview draft"}</button>
        {draft ? (
          <>
            <button type="button" className={primaryBtn} data-testid="button-save-template" disabled={busy || !dirty} onClick={() => run({ action: "save_template", templateId: tpl.id, revision: baseRevision, content }, () => setDirty(false))}><Save className="h-4 w-4" /> Save template</button>
            <button type="button" className={ghostBtn} data-testid="button-publish-template" disabled={busy || dirty} title={dirty ? "Save first" : undefined} onClick={() => setConfirmPub(true)}><Send className="h-4 w-4" /> Publish version</button>
          </>
        ) : (
          <button type="button" className={primaryBtn} data-testid="button-clone-template" disabled={busy} onClick={() => run({ action: "clone_template", templateId: tpl.id, revision: tpl.revision }, (r) => { if (r.templateId) onSelect(r.templateId); })}><Copy className="h-4 w-4" /> Clone as new draft version</button>
        )}
      </div>
      {!draft && <p className="rounded-md bg-sky-50 p-3 text-sm text-sky-900">This version is published and locked so existing reviews are not changed. Clone it to make edits for a future term.</p>}
      {draft && dirty && <p className="text-xs font-semibold text-amber-700" data-testid="text-unsaved">Unsaved changes</p>}

      {preview ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" data-testid="template-preview">
          <h2 className="text-lg font-bold">{content.title}</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{content.welcome}</p>
          <p className="whitespace-pre-line rounded bg-teal-50 p-3 text-sm text-teal-900">{content.instructions}</p>
          {content.sections.map((s) => (
            <div key={s.id}><h3 className="font-bold text-slate-900">{s.title}</h3><p className="text-xs text-slate-500">{s.instructions}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{s.questions.map((q) => <li key={q.id}>{q.prompt}{q.required && <span className="text-rose-600"> *</span>}</li>)}</ol></div>
          ))}
          <p className="text-xs text-slate-600">Targets: {content.targetExamples.academic} / {content.targetExamples.personal} / {content.targetExamples.future}</p>
          <p className="whitespace-pre-line text-sm text-slate-700">{content.endGuidance}</p>
        </div>
      ) : (
        <fieldset disabled={!draft} className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Title" htmlFor="tpl-title"><input id="tpl-title" data-testid="input-template-title" className={inputCls} value={content.title} onChange={(e) => set({ ...content, title: e.target.value })} /></Field></div>
            <Field label="Welcome message" htmlFor="tpl-welcome"><textarea id="tpl-welcome" data-testid="input-template-welcome" rows={4} className={inputCls} value={content.welcome} onChange={(e) => set({ ...content, welcome: e.target.value })} /></Field>
            <Field label="Instructions" htmlFor="tpl-instr"><textarea id="tpl-instr" data-testid="input-template-instructions" rows={4} className={inputCls} value={content.instructions} onChange={(e) => set({ ...content, instructions: e.target.value })} /></Field>
            <Field label="End-of-term guidance" htmlFor="tpl-end"><textarea id="tpl-end" data-testid="input-template-end" rows={3} className={inputCls} value={content.endGuidance} onChange={(e) => set({ ...content, endGuidance: e.target.value })} /></Field>
            <div className="space-y-2">
              {(["academic", "personal", "future"] as const).map((k) => (
                <Field key={k} label={`Example ${k} target`} htmlFor={`tpl-ex-${k}`}><input id={`tpl-ex-${k}`} data-testid={`input-example-${k}`} className={inputCls} value={content.targetExamples[k]} onChange={(e) => set({ ...content, targetExamples: { ...content.targetExamples, [k]: e.target.value } })} /></Field>
              ))}
            </div>
          </div>

          {content.sections.map((s, i) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4" data-testid={`section-editor-${i}`}>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1"><Field label={`Section ${i + 1} title`} htmlFor={`sec-t-${s.id}`}><input id={`sec-t-${s.id}`} data-testid={`input-section-title-${i}`} className={inputCls} value={s.title} onChange={(e) => sec(i, { title: e.target.value })} /></Field></div>
                <button type="button" aria-label="Move section up" data-testid={`button-section-up-${i}`} className={ghostBtn} disabled={i === 0} onClick={() => set({ ...content, sections: move(content.sections, i, -1) })}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Move section down" data-testid={`button-section-down-${i}`} className={ghostBtn} disabled={i === content.sections.length - 1} onClick={() => set({ ...content, sections: move(content.sections, i, 1) })}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label="Delete section" data-testid={`button-section-delete-${i}`} className={ghostBtn} onClick={() => { if (window.confirm(`Delete section "${s.title}" and its questions?`)) set({ ...content, sections: content.sections.filter((_, k) => k !== i) }); }}><Trash2 className="h-4 w-4 text-rose-700" /></button>
              </div>
              <div className="mt-2"><Field label="Section instructions" htmlFor={`sec-i-${s.id}`}><textarea id={`sec-i-${s.id}`} rows={2} className={inputCls} value={s.instructions} onChange={(e) => sec(i, { instructions: e.target.value })} /></Field></div>
              <ul className="mt-3 space-y-2">
                {s.questions.map((q, j) => (
                  <li key={q.id} className="flex flex-wrap items-start gap-2 rounded-md bg-slate-50 p-2" data-testid={`question-editor-${i}-${j}`}>
                    <textarea aria-label={`Question ${j + 1} prompt`} data-testid={`input-question-${i}-${j}`} rows={2} className={`${inputCls} min-w-48 flex-1`} value={q.prompt} onChange={(e) => sec(i, { questions: s.questions.map((x, k) => k === j ? { ...x, prompt: e.target.value } : x) })} />
                    <label className="flex min-h-10 items-center gap-1 text-xs font-semibold text-slate-700"><input type="checkbox" data-testid={`check-required-${i}-${j}`} checked={q.required} onChange={(e) => sec(i, { questions: s.questions.map((x, k) => k === j ? { ...x, required: e.target.checked } : x) })} /> Required</label>
                    <button type="button" aria-label="Move question up" className={ghostBtn} disabled={j === 0} onClick={() => sec(i, { questions: move(s.questions, j, -1) })}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="Move question down" className={ghostBtn} disabled={j === s.questions.length - 1} onClick={() => sec(i, { questions: move(s.questions, j, 1) })}><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label="Delete question" data-testid={`button-question-delete-${i}-${j}`} className={ghostBtn} onClick={() => sec(i, { questions: s.questions.filter((_, k) => k !== j) })}><Trash2 className="h-4 w-4 text-rose-700" /></button>
                  </li>
                ))}
              </ul>
              <button type="button" data-testid={`button-add-question-${i}`} className={`${ghostBtn} mt-2`} onClick={() => sec(i, { questions: [...s.questions, { id: uid("q"), prompt: "", required: true }] })}><Plus className="h-4 w-4" /> Add question</button>
            </div>
          ))}
          <button type="button" data-testid="button-add-section" className={ghostBtn} onClick={() => set({ ...content, sections: [...content.sections, { id: uid("s"), title: "New section", instructions: "", questions: [] }] })}><Plus className="h-4 w-4" /> Add section</button>
        </fieldset>
      )}

      {confirmPub && (
        <Confirm title={`Publish Term ${tpl.term} version ${tpl.version}?`} confirmLabel="Publish version" busy={busy} onCancel={() => setConfirmPub(false)}
          onConfirm={() => { run({ action: "publish_template", templateId: tpl.id, revision: baseRevision }, () => setConfirmPub(false)); }}>
          Publishing locks this version. It will not change reviews that are already in progress. To use it, publish a term on the Terms tab.
        </Confirm>
      )}
    </div>
  );
}
