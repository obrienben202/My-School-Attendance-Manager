export interface PersonalSlot {
  id: string | number;
  day: string;
  startTime: string | null;
  endTime: string | null;
  description: string;
  groupLabel: string | null;
  room: string | null;
  weekPattern?: string | null;
}

export function myTimetableQuery(userId: string | undefined, timetableOpen: boolean) {
  const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");
  return {
    queryKey: ["my-timetable", userId] as const,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<PersonalSlot[]> => {
      const response = await fetch(`${base}/api/staff/my-timetable`, { credentials: "include", cache: "no-store", signal });
      if (!response.ok) throw new Error("Could not load timetable");
      return response.json();
    },
    enabled: !!userId && timetableOpen,
    staleTime: 0,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: true,
    refetchInterval: timetableOpen ? 60_000 : false as const,
    refetchIntervalInBackground: false,
  };
}