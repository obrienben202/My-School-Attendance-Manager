import type { Request, Response } from "express";

const CONCIERGE_ROLES = new Set(["admin", "hod", "office"]);

export function requireConciergeAccess(
  req: Request,
  res: Response,
): req is Request & { user: Express.User } {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to access enrolment records." });
    return false;
  }
  if (!CONCIERGE_ROLES.has(req.user.role)) {
    res.status(403).json({ error: "Concierge access is required." });
    return false;
  }
  return true;
}