import { useAuth } from "@workspace/replit-auth-web";

export type Role = "admin" | "hod" | "staff" | "office";

export function useRole(): Role {
  const { user } = useAuth();
  const rawRole = (user as { role?: string } | null)?.role;
  const role = rawRole?.toLowerCase();
  if (role === "admin" || role === "hod" || role === "staff" || role === "office") {
    return role;
  }
  return "staff";
}

export function useIsAdmin(): boolean {
  return useRole() === "admin";
}

export function hasAccess(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}
