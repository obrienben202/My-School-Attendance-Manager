import { useMemo, useState } from "react";
import type { TermlyIlpAdmin } from "@workspace/api-client-react";
import { Save } from "lucide-react";
import { ghostBtn, inputCls } from "./admin-ui";

type Cmd = (data: Record<string, unknown>, after?: (r: { templateId?: number }) => void) => void;

export function PeoplePanel({ data, run, busy }: { data: TermlyIlpAdmin; run: Cmd; busy: boolean }) {
  const [search, setSearch] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [edits, setEdits] = useState<Record<string, { l?: string | null; t?: string | null }>>({});
  const learnersAcc = data.users.filter((u) => u.role === "learner");
  const tutors = data.users.filter((u) => ["staff", "hod", "admin"].includes(u.role));
  const rows = useMemo(() => data.learners.filter((l) => (!onlyGaps || !l.learnerUserId || !l.tutorUserId) && `${l.studentName} ${l.personCode}`.toLowerCase().includes(search.toLowerCase())), [data.learners, search, onlyGaps]);
  const gaps = data.learners.filter((l) => !l.learnerUserId || !l.tutorUserId).length;

  return (
    <div className="space-y-3" data-testid="people-panel">
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Search learners" data-testid="input-search-learners" placeholder="Search name or person code" className={`${inputCls} max-w-64`} value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" data-testid="check-only-gaps" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} /> Only show missing account or RG teacher ({gaps})</label>
      </div>
      {rows.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600" data-testid="empty-learners">No learners match.</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-3 py-2">Learner</th><th className="px-3 py-2">Person code</th><th className="px-3 py-2">Learner account</th><th className="px-3 py-2">RG teacher</th><th className="px-3 py-2"><span className="sr-only">Save</span></th></tr></thead>
            <tbody>
              {rows.map((l) => {
                const e = edits[l.personCode];
                const lv = e?.l !== undefined ? e.l : l.learnerUserId;
                const tv = e?.t !== undefined ? e.t : l.tutorUserId;
                const changed = e !== undefined && (lv !== l.learnerUserId || tv !== l.tutorUserId);
                return (
                  <tr key={l.studentId} className="border-t border-slate-100" data-testid={`row-learner-${l.studentId}`}>
                    <td className="px-3 py-2 font-medium">{l.studentName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.personCode}</td>
                    <td className="px-3 py-2">
                      <select aria-label={`Account for ${l.studentName}`} data-testid={`select-account-${l.studentId}`} className={inputCls} value={lv ?? ""} onChange={(ev) => setEdits({ ...edits, [l.personCode]: { ...e, l: ev.target.value || null } })}>
                        <option value="">Not linked</option>
                        {learnersAcc.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
                      </select>
                      {!lv && <span className="mt-1 block text-[11px] font-semibold text-rose-700">Missing account</span>}
                    </td>
                    <td className="px-3 py-2">
                      <select aria-label={`RG teacher for ${l.studentName}`} data-testid={`select-tutor-${l.studentId}`} className={inputCls} value={tv ?? ""} onChange={(ev) => setEdits({ ...edits, [l.personCode]: { ...e, t: ev.target.value || null } })}>
                        <option value="">Not assigned</option>
                        {tutors.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                      </select>
                      {!tv && <span className="mt-1 block text-[11px] font-semibold text-rose-700">Missing RG teacher</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" data-testid={`button-save-assignment-${l.studentId}`} className={ghostBtn} disabled={!changed || busy}
                        onClick={() => run({ action: "assign", personCode: l.personCode, learnerUserId: lv ?? null, tutorUserId: tv ?? null }, () => setEdits((p) => { const n = { ...p }; delete n[l.personCode]; return n; }))}>
                        <Save className="h-4 w-4" /> Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
