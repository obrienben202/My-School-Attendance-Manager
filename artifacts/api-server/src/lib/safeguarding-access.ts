export type SafeguardingUser = {
  role: string;
} | null | undefined;

export function canAccessSafeguarding(user: SafeguardingUser): boolean {
  return user?.role === "staff" || user?.role === "hod";
}