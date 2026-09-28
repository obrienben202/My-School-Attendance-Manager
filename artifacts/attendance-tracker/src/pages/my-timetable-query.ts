export interface PersonalSlot {
  id: number;
  day: string;
  startTime: string | null;
  endTime: string | null;
  description: string;
  groupLabel: string | null;
  room: string | null;
}

export function myTimetableQuery(userId: string | undefined, timetableOpen: boolean) {
  return {
    queryKey: ["my-timetable", userId] as const,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<PersonalSlot[]> => {
      const response = await fetch("/api/staff/my-timetable", { credentials: "include", signal });
      if (!response.ok) throw new Error("Could not load timetable");
      return response.json();
    },
    enabled: !!userId && timetableOpen,
  };
}