import type { AuthUser } from "@workspace/api-zod";

export type CurrentUserRecord = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  username: string | null;
  department: string | null;
};

export function userToAuthUser(user: CurrentUserRecord): AuthUser {
  const validRoles: AuthUser["role"][] = ["admin", "hod", "staff", "office"];
  if (!validRoles.includes(user.role as AuthUser["role"])) {
    throw new Error(`Stored user has unsupported role "${user.role}"`);
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    role: user.role as AuthUser["role"],
    username: user.username,
    department: user.department,
  };
}

export function resolveCurrentSessionUser(
  _sessionSnapshot: AuthUser,
  currentUser: CurrentUserRecord | null,
): AuthUser | null {
  return currentUser ? userToAuthUser(currentUser) : null;
}