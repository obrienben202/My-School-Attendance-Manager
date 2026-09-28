// The endpoint is scoped to the session on the server, so its client cache must
// also be scoped to the authenticated identity.
export function plannedAbsenceQuery(userId: string | undefined) {
  return {
    queryKey: ["/api/planned-absences", userId] as const,
    enabled: !!userId,
  };
}