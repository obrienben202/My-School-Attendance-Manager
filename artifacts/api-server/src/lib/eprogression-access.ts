import type { Request, Response } from "express";

export type EprogressionOperation = "list" | "submit" | "decide" | "delete";

// All staff roles can see submissions and submit them. Only administrators
// can decide a pending submission or permanently remove one.
const PERMISSIONS: Record<EprogressionOperation, ReadonlySet<string>> = {
  list: new Set(["admin", "hod", "staff", "office"]),
  submit: new Set(["admin", "hod", "staff", "office"]),
  decide: new Set(["admin"]),
  delete: new Set(["admin"]),
};

export function canAccessEprogression(role: string, operation: EprogressionOperation): boolean {
  return PERMISSIONS[operation].has(role);
}

export function requireEprogressionAccess(
  req: Request,
  res: Response,
  operation: EprogressionOperation,
): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  if (!canAccessEprogression(req.user.role, operation)) {
    res.status(403).json({ error: "Insufficient eProgression permissions" });
    return false;
  }
  return true;
}