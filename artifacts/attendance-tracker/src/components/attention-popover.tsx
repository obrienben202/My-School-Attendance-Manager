import { useState } from "react";
import { Bell, CalendarClock, Check, ClipboardList, Target } from "lucide-react";
import { Link } from "wouter";
import {
  getGetTodayScheduleQueryKey,
  getListIlpsQueryKey,
  getListTargetsQueryKey,
  useGetTodaySchedule,
  useListIlps,
  useListTargets,
} from "@workspace/api-client-react";
import { getReviewStatus, isIlpOpen, isTutorOwner } from "@/lib/ilp";
import type { Role } from "@/hooks/use-role";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AttentionPopover({ role, userName, userId }: { role: Role; userName: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const canSeeTargets = role === "admin" || role === "hod" || role === "office";
  const canSeeReviews = role !== "office";
  const freshness = { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true };
  const schedule = useGetTodaySchedule({ query: { ...freshness, queryKey: [...getGetTodayScheduleQueryKey(), userId] } });
  const targets = useListTargets({ overdue: true }, { query: { ...freshness, queryKey: [...getListTargetsQueryKey({ overdue: true }), userId], enabled: canSeeTargets } });
  const ilps = useListIlps(undefined, { query: { ...freshness, queryKey: [...getListIlpsQueryKey(), userId], enabled: canSeeReviews } });

  const pendingRegisters = (schedule.data ?? []).filter((entry) => !entry.registerMarked);
  const overdueTargets = canSeeTargets ? (targets.data ?? []) : [];
  const overdueReviews = canSeeReviews
    ? (ilps.data ?? []).filter((ilp) =>
        isIlpOpen(ilp) &&
        getReviewStatus(ilp) === "Overdue" &&
        (role === "admin" || role === "hod" || isTutorOwner(ilp.tutor, userName)),
      )
    : [];
  const total = pendingRegisters.length + overdueTargets.length + overdueReviews.length;
  const loading = schedule.isLoading || (canSeeTargets && targets.isLoading) || (canSeeReviews && ilps.isLoading);
  const failed = schedule.isError || (canSeeTargets && targets.isError) || (canSeeReviews && ilps.isError);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Needs attention${total ? `, ${total} items` : ""}`}
          data-testid="button-notifications"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span data-testid="count-notifications" className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-5 text-white">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-semibold">Needs attention</p>
          <p className="text-xs text-muted-foreground">Live work items, not read or unread messages</p>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 text-sm">
          {loading && <p className="px-2 py-3 text-muted-foreground">Checking your work items…</p>}
          {failed && (
            <div role="alert" className="px-2 py-3 text-red-600">
              Some work items could not be loaded.{" "}
              <button type="button" data-testid="button-retry-notifications" className="underline" onClick={() => {
                if (schedule.isError) void schedule.refetch();
                if (targets.isError) void targets.refetch();
                if (ilps.isError) void ilps.refetch();
              }}>Retry</button>
            </div>
          )}
          {pendingRegisters.map((entry) => (
            <Link key={`register-${entry.id}`} href="/attendance" onClick={() => setOpen(false)} data-testid={`link-notification-register-${entry.id}`} className="flex gap-3 rounded-md px-2 py-2 hover:bg-muted">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span><strong className="block font-medium">{entry.courseName}</strong><span className="text-xs text-muted-foreground">Today · {entry.startTime} · Register needs marking</span></span>
            </Link>
          ))}
          {overdueTargets.map((target) => (
            <Link key={`target-${target.id}`} href="/targets" onClick={() => setOpen(false)} data-testid={`link-notification-target-${target.id}`} className="flex gap-3 rounded-md px-2 py-2 hover:bg-muted">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span><strong className="block font-medium">{target.title}</strong><span className="text-xs text-muted-foreground">Overdue target · Due {target.dueDate}</span></span>
            </Link>
          ))}
          {overdueReviews.map((ilp) => (
            <Link key={`review-${ilp.id}`} href={`/ilp-tutor/reviews?ilpId=${ilp.id}`} onClick={() => setOpen(false)} data-testid={`link-notification-review-${ilp.id}`} className="flex gap-3 rounded-md px-2 py-2 hover:bg-muted">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span><strong className="block font-medium">{ilp.title}</strong><span className="text-xs text-muted-foreground">Overdue ILP review · Due {ilp.nextReviewDue}</span></span>
            </Link>
          ))}
          {!loading && !failed && total === 0 && (
            <p data-testid="status-no-notifications" className="flex items-center gap-2 px-2 py-4 text-muted-foreground"><Check className="h-4 w-4" /> Nothing needs attention right now.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}