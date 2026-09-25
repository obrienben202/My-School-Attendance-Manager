export type SafeguardingUser = {
  role: string;
} | null | undefined;

export function canAccessSafeguardingNotes(user: SafeguardingUser): boolean {
  return user?.role === "admin" || user?.role === "staff" || user?.role === "hod";
}

export function canAccessSafeguardingAtRiskReport(user: SafeguardingUser): boolean {
  return user?.role === "staff" || user?.role === "hod";
}