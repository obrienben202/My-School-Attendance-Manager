import bcrypt from "bcryptjs";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
} from "../lib/auth";
import {
  fetchDirectoryCsv,
  syncUsersFromDirectory,
} from "../lib/user-directory";
import { userToAuthUser } from "../lib/session-user";

const router: IRouter = Router();

const GAS_AUTH_URL =
  "https://script.google.com/macros/s/AKfycbzURwLj_tTf7tZX7BIT4b6_NuU6WE64zCoGakr0zmwB1PQ695w-DLV8ksvJM9xsZ81E/exec";

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function requireAdmin(req: Request, res: Response): boolean {
  const u = req.user as { role?: string } | undefined;
  if (!req.isAuthenticated() || u?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

export function requireAdminOrHod(req: Request, res: Response): boolean {
  const u = req.user as { role?: string } | undefined;
  const role = u?.role;
  if (!req.isAuthenticated() || (role !== "admin" && role !== "hod")) {
    res.status(403).json({ error: "Admin or Head of Department access required" });
    return false;
  }
  return true;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

router.get("/auth/user", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const normalizedUsername = username.trim().toLowerCase();

  // ── Authenticate against the school's Google Apps Script ──────────────────
  type GasResult = { success: boolean; role?: string; fullName?: string; message?: string };
  let gasResult: GasResult | null = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const gasRes = await fetch(GAS_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ username: normalizedUsername, password }).toString(),
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    if (gasRes.ok) {
      const text = await gasRes.text();
      try {
        gasResult = JSON.parse(text) as GasResult;
      } catch {
        // malformed response — fall through to local fallback
      }
    }
  } catch (err) {
    req.log.warn({ err }, "GAS auth endpoint unreachable — attempting local fallback");
  }

  // ── If GAS authenticated successfully, create/update the user ─────────────
  if (gasResult?.success) {
    const gasFullName = gasResult.fullName ?? normalizedUsername;

    // The GAS response proves the password, but the directory owns roles.
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, normalizedUsername));

    let dbUser: typeof usersTable.$inferSelect;

    if (existing) {
      // Do not copy GAS role claims into the application account.
      const [updated] = await db
        .update(usersTable)
        .set({ firstName: gasFullName, updatedAt: new Date() })
        .where(eq(usersTable.username, normalizedUsername))
        .returning();
      dbUser = updated;
    } else {
      // New accounts must first be introduced by a validated directory sync.
      res.status(403).json({
        error: "Account is not present in the school directory. Ask an administrator to sync users.",
      });
      return;
    }

    const sid = await createSession({ user: userToAuthUser(dbUser) });
    setSessionCookie(res, sid);
    res.json({ ok: true });
    return;
  }

  // ── GAS rejected credentials (or was unreachable) — try local bcrypt hash ──
  // This acts as a fallback when the school portal is down, or for users
  // seeded directly via the Sync button.
  if (gasResult !== null && !gasResult.success) {
    // GAS responded but said credentials are wrong — no point checking locally
    res.status(401).json({ error: gasResult.message ?? "Invalid username or password" });
    return;
  }

  // GAS was unreachable — try the locally-stored bcrypt hash as a fallback
  const [localUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, normalizedUsername));

  if (localUser?.passwordHash) {
    const valid = await bcrypt.compare(password, localUser.passwordHash);
    if (valid) {
      const sid = await createSession({ user: userToAuthUser(localUser) });
      setSessionCookie(res, sid);
      res.json({ ok: true });
      return;
    }
  }

  res.status(401).json({ error: "Invalid username or password" });
});

router.post("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ ok: true });
});

// Backward-compat redirect for any old GET /logout links
router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

// ── Admin: Sync users from Google Sheet ──────────────────────────────────────

router.post("/admin/sync-users", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  let csv: string;
  try {
    csv = await fetchDirectoryCsv();
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Google Sheet");
    res
      .status(502)
      .json({ error: "Failed to fetch user list from Google Sheet" });
    return;
  }

  const summary = await syncUsersFromDirectory(csv);
  res.status(summary.invalid > 0 || summary.duplicates > 0 ? 422 : 200).json({
    synced: summary.inserted + summary.updated,
    summary,
  });
});

// ── Admin: User Management ────────────────────────────────────────────────────

router.get("/admin/users", async (req: Request, res: Response) => {
  if (!requireAdminOrHod(req, res)) return;
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      role: usersTable.role,
      department: usersTable.department,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(users);
});

router.patch("/admin/users/:id/role", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.status(409).json({
    error: "Roles are managed by the school directory and cannot be changed locally.",
  });
});

router.delete("/admin/users/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id);
  const me = req.user as { id?: string } | undefined;
  if (me?.id === id) {
    res.status(400).json({ error: "Cannot remove yourself" });
    return;
  }
  const [deleted] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ success: true });
});

// Keep mobile-auth endpoints for any mobile clients
router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json({ success: true });
});

export default router;
