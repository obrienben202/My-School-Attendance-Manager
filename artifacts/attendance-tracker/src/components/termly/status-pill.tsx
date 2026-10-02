import { STATUS_LABEL, STATUS_STYLE } from "@/hooks/use-termly";

export function StatusPill({ status, overdue }: { status: string; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span data-testid={`status-${status}`} className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] ?? STATUS_STYLE.not_started}`}>
        {STATUS_LABEL[status] ?? status}
      </span>
      {overdue && status !== "reviewed" && status !== "submitted" && (
        <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Overdue</span>
      )}
    </span>
  );
}
