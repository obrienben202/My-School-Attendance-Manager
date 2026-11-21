// Keep the generated endpoint key as a prefix so successful saves invalidate
// every active safeguarding reader, while never sharing a cache across roles.
export function safeguardingNotesOptions(userId: string, role: string) {
  return {
    query: {
      queryKey: ["/api/safeguarding/notes", userId, role] as const,
      staleTime: 0,
      gcTime: 0,
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: "always" as const,
      refetchOnReconnect: "always" as const,
    },
    request: { cache: "no-store" as const },
  };
}
