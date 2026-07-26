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

const router: IRouter = Router();

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1NNNADb5EBivGR_SZ8FHzvHr3dpzQZRMXLWgTg09oD24/export?format=csv";

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function mapRole(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (r === "admin" || r === "hr") return "admin";
  if (r === "hod") return "hod";
  if (r === "office") return "office";
  return "staff";
}

function requireAdmin(req: Request, res: Response): boolean {
  const u = req.user as { role?: string } | undefined;
  if (!req.isAuthenticated() || u?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

router.get("/auth/user", (req: Request, res: Response) => {
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

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username.trim().toLowerCase()));

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const sid = await createSession({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      username: user.username,
      department: user.department,
    },
  });
  setSessionCookie(res, sid);
  res.json({ ok: true });
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
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    csv = await response.text();
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Google Sheet");
    res
      .status(502)
      .json({ error: "Failed to fetch user list from Google Sheet" });
    return;
  }

  const lines = csv.trim().split(/\r?\n/).slice(1); // skip header row
  const errors: string[] = [];
  let synced = 0;

  for (const line of lines) {
    // Simple CSV parse: split on comma, strip surrounding quotes
    const parts = line
      .split(",")
      .map((p) => p.trim().replace(/^"|"$/g, "").trim());
    if (parts.length < 4) continue;
    const [rawUsername, rawPassword, rawRole, fullName, department] = parts;
    if (!rawUsername || !rawPassword) continue;

    try {
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      const role = mapRole(rawRole ?? "staff");
      const username = rawUsername.toLowerCase();

      await db
        .insert(usersTable)
        .values({
          username,
          passwordHash,
          role,
          firstName: fullName ?? rawUsername,
          lastName: null,
          department: department ?? null,
          email: null,
          profileImageUrl: null,
        })
        .onConflictDoUpdate({
          target: usersTable.username,
          set: {
            passwordHash,
            role,
            firstName: fullName ?? rawUsername,
            department: department ?? null,
            updatedAt: new Date(),
          },
        });
      synced++;
    } catch (err) {
      errors.push(`${rawUsername}: ${String(err)}`);
    }
  }

  res.json({ synced, errors });
});

// ── Admin: User Management ────────────────────────────────────────────────────

router.get("/admin/users", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(users);
});

router.patch("/admin/users/:id/role", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id);
  const { role } = req.body as { role?: string };
  const allowed = ["admin", "hod", "staff", "office"];
  if (!role || !allowed.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const me = req.user as { id?: string } | undefined;
  if (me?.id === id) {
    res.status(400).json({ error: "Cannot change your own role" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ role, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
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
