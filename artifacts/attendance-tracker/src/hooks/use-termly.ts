import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetTermlyIlpAdminQueryKey,
  getGetTermlyIlpFeedQueryKey,
  getGetTermlyIlpReviewQueryKey,
  useGetTermlyIlpAdmin,
  useGetTermlyIlpFeed,
  useGetTermlyIlpReview,
} from "@workspace/api-client-react";

const request = { cache: "no-store" as RequestCache, headers: { "Cache-Control": "no-store" } };
const quiet = { refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: Infinity, gcTime: 0, retry: false } as const;

function useIdentity() {
  const { user } = useAuth();
  return String((user as { id?: string | number } | null)?.id ?? "anon");
}

export function useTermlyFeed() {
  const who = useIdentity();
  return useGetTermlyIlpFeed({ request, query: { ...quiet, staleTime: 10000, refetchInterval: 30000, refetchOnWindowFocus: true, queryKey: [...getGetTermlyIlpFeedQueryKey(), who] } });
}

export function useTermlyAdmin() {
  const who = useIdentity();
  return useGetTermlyIlpAdmin({ request, query: { ...quiet, staleTime: 10000, refetchInterval: 30000, refetchOnWindowFocus: true, queryKey: [...getGetTermlyIlpAdminQueryKey(), who] } });
}

export function useTermlyReview(id: number, supportReason?: string, enabled = true) {
  const who = useIdentity();
  const params = supportReason ? { supportReason } : undefined;
  return useGetTermlyIlpReview(id, params, {
    request,
    query: { ...quiet, enabled: enabled && id > 0, queryKey: [...getGetTermlyIlpReviewQueryKey(id, params), who] },
  });
}

export function errorMessage(e: unknown): string {
  const err = e as { data?: { error?: string } | null; message?: string };
  return err?.data?.error ?? err?.message ?? "Something went wrong. Please try again.";
}

export function isConflict(e: unknown): boolean {
  return (e as { status?: number })?.status === 409;
}

export const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  draft: "In progress",
  submitted: "Submitted",
  reviewed: "Reviewed",
  returned: "Returned for changes",
};

export const STATUS_STYLE: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-700 border-slate-200",
  draft: "bg-amber-50 text-amber-800 border-amber-200",
  submitted: "bg-sky-50 text-sky-800 border-sky-200",
  reviewed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  returned: "bg-rose-50 text-rose-800 border-rose-200",
};
