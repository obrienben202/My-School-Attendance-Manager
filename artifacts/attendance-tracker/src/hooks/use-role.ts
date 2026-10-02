import { useAuth } from "@workspace/replit-auth-web";

export type Role = "admin" | "hod" | "staff" | "office" | "learner";

/** Unknown or missing roles fail closed to the most restricted role (learner), never staff. */
export function useRole(): Role {
  const { user } = useAuth();
  const rawRole = (user as { role?: string } | null)?.role;
  const role = typeof rawRole === "string" ? rawRole.toLowerCase() : "";
  if (role === "admin" || role === "hod" || role === "staff" || role === "office") {
    return role;
  }
  return "learner";
}

export function useIsAdmin(): boolean {
  return useRole() === "admin";
}

export function hasAccess(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}
