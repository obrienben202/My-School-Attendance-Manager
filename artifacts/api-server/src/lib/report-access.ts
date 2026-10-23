export type ReportUser = { role: string } | null | undefined;

const REPORT_ROLES = new Set(["admin", "hod", "office"]);

export function canAccessReports(user: ReportUser): boolean {
  return Boolean(user && REPORT_ROLES.has(user.role));
}