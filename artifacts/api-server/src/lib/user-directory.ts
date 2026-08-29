import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const DIRECTORY_CSV_URL =
  process.env.USER_DIRECTORY_CSV_URL ??
  "https://docs.google.com/spreadsheets/d/1NNNADb5EBivGR_SZ8FHzvHr3dpzQZRMXLWgTg09oD24/export?format=csv";

export const DIRECTORY_ROLES = ["admin", "hod", "staff", "office"] as const;
export type DirectoryRole = (typeof DIRECTORY_ROLES)[number];

/**
 * These are the only source values accepted by the school directory.
 * Keep aliases explicit: an unknown or blank value must never become staff.
 */
const ROLE_ALIASES: Record<string, DirectoryRole> = {
  admin: "admin",
  administrator: "admin",
  administrators: "admin",
  hr: "admin",
  hod: "hod",
  "head of department": "hod",
  "head of dept": "hod",
  head_of_department: "hod",
  staff: "staff",
  teacher: "staff",
  teachers: "staff",
  "teaching staff": "staff",
  office: "office",
  "office staff": "office",
  "admin office": "office",
};

export type DirectoryUserRecord = {
  rowNumber: number;
  username: string;
  password: string;
  role: DirectoryRole;
  fullName: string;
  department: string | null;
};

export type DirectoryIssue = {
  rowNumber: number;
  username?: string;
  message: string;
};

export type DirectoryParseResult = {
  records: DirectoryUserRecord[];
  invalid: DirectoryIssue[];
  duplicates: DirectoryIssue[];
  errors: string[];
  safe: boolean;
};

export type UserSyncSummary = {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  retired: number;
  invalid: number;
  duplicates: number;
  unmatched: number;
  errors: string[];
};

export function emptyUserSyncSummary(): UserSyncSummary {
  return {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    retired: 0,
    invalid: 0,
    duplicates: 0,
    unmatched: 0,
    errors: [],
  };
}

export function normalizeDirectoryUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function normalizeDirectoryRole(raw: string): DirectoryRole {
  const key = raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const role = ROLE_ALIASES[key];
  if (!role) {
    throw new Error(
      raw.trim()
        ? `Unknown directory role "${raw.trim()}"`
        : "Directory role is blank",
    );
  }
  return role;
}

/**
 * RFC 4180-compatible enough for the directory export: quoted commas,
 * escaped quotes, CRLF, and quoted newlines are all handled.
 */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unterminated quoted field");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = new Set(aliases.map(headerKey));
  return headers.findIndex((header) => normalized.has(headerKey(header)));
}

function rowIsBlank(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

export function parseDirectoryCsv(csv: string): DirectoryParseResult {
  const result: DirectoryParseResult = {
    records: [],
    invalid: [],
    duplicates: [],
    errors: [],
    safe: false,
  };

  let rows: string[][];
  try {
    rows = parseCsv(csv);
  } catch (error) {
    result.invalid.push({
      rowNumber: 1,
      message: error instanceof Error ? error.message : "Malformed CSV",
    });
    result.errors.push(result.invalid[0].message);
    return result;
  }

  const header = rows[0] ?? [];
  const usernameColumn = findColumn(header, ["username", "user", "user name", "login"]);
  const passwordColumn = findColumn(header, ["password", "pass"]);
  const roleColumn = findColumn(header, ["role", "account role", "user role"]);
  const nameColumn = findColumn(header, ["fullname", "full name", "name", "display name"]);
  const departmentColumn = findColumn(header, ["department", "dept"]);

  const missingHeaders = [
    usernameColumn < 0 ? "username" : null,
    passwordColumn < 0 ? "password" : null,
    roleColumn < 0 ? "role" : null,
  ].filter((value): value is string => value !== null);

  if (missingHeaders.length > 0) {
    const message = `Directory is missing required column(s): ${missingHeaders.join(", ")}`;
    result.invalid.push({ rowNumber: 1, message });
    result.errors.push(message);
    return result;
  }

  const seen = new Set<string>();
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 1;
    if (rowIsBlank(row)) continue;

    const rawUsername = row[usernameColumn]?.trim() ?? "";
    const rawPassword = row[passwordColumn]?.trim() ?? "";
    const rawRole = row[roleColumn]?.trim() ?? "";
    const username = normalizeDirectoryUsername(rawUsername);
    const issues: string[] = [];

    if (!username) issues.push("username is blank");
    if (!rawPassword) issues.push("password is blank");

    let role: DirectoryRole | undefined;
    try {
      role = normalizeDirectoryRole(rawRole);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "invalid role");
    }

    if (issues.length > 0) {
      const issue = { rowNumber, username: username || undefined, message: issues.join("; ") };
      result.invalid.push(issue);
      result.errors.push(`Row ${rowNumber}: ${issue.message}`);
      continue;
    }

    if (seen.has(username)) {
      const issue = {
        rowNumber,
        username,
        message: `duplicate username "${username}"`,
      };
      result.duplicates.push(issue);
      result.errors.push(`Row ${rowNumber}: ${issue.message}`);
      continue;
    }
    seen.add(username);

    result.records.push({
      rowNumber,
      username,
      password: rawPassword,
      role: role!,
      fullName: (row[nameColumn]?.trim() || rawUsername).trim(),
      department: row[departmentColumn]?.trim() || null,
    });
  }

  if (result.records.length === 0) {
    result.errors.push("Directory contained no valid user records");
  }
  result.safe = result.records.length > 0 && result.invalid.length === 0 && result.duplicates.length === 0;
  return result;
}

type ExistingDirectoryUser = Pick<
  typeof usersTable.$inferSelect,
  "id" | "username" | "role" | "firstName" | "department" | "passwordHash"
>;

export type UserReconciliationPlan = {
  inserts: DirectoryUserRecord[];
  updates: DirectoryUserRecord[];
  unchanged: DirectoryUserRecord[];
  unmatched: ExistingDirectoryUser[];
};

export function planUserReconciliation(
  records: DirectoryUserRecord[],
  existing: ExistingDirectoryUser[],
): UserReconciliationPlan {
  const byUsername = new Map(
    existing
      .filter((user) => user.username)
      .map((user) => [normalizeDirectoryUsername(user.username!), user]),
  );
  const matched = new Set<string>();
  const inserts: DirectoryUserRecord[] = [];
  const updates: DirectoryUserRecord[] = [];
  const unchanged: DirectoryUserRecord[] = [];

  for (const record of records) {
    const current = byUsername.get(record.username);
    if (!current) {
      inserts.push(record);
      continue;
    }

    matched.add(current.id);
    const sameProfile =
      current.role === record.role &&
      (current.firstName ?? "") === record.fullName &&
      (current.department ?? null) === record.department;
    if (sameProfile) unchanged.push(record);
    else updates.push(record);
  }

  return {
    inserts,
    updates,
    unchanged,
    unmatched: existing.filter((user) => !matched.has(user.id)),
  };
}

async function reconcileUsersInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  records: DirectoryUserRecord[],
): Promise<UserSyncSummary> {
  const existing = await tx
    .select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      firstName: usersTable.firstName,
      department: usersTable.department,
      passwordHash: usersTable.passwordHash,
    })
    .from(usersTable);
  const plan = planUserReconciliation(records, existing);
  const summary = emptyUserSyncSummary();
  summary.unmatched = plan.unmatched.length;
  summary.unchanged = plan.unchanged.length;

  for (const record of plan.inserts) {
    await tx.insert(usersTable).values({
      username: record.username,
      passwordHash: await bcrypt.hash(record.password, 10),
      role: record.role,
      firstName: record.fullName,
      lastName: null,
      email: null,
      profileImageUrl: null,
      department: record.department,
    });
    summary.inserted++;
  }

  for (const record of [...plan.updates, ...plan.unchanged]) {
    const current = existing.find(
      (user) => normalizeDirectoryUsername(user.username ?? "") === record.username,
    );
    if (!current) continue;
    const passwordUnchanged = current.passwordHash
      ? await bcrypt.compare(record.password, current.passwordHash)
      : false;
    const profileUnchanged = plan.unchanged.includes(record);
    if (!profileUnchanged || !passwordUnchanged) {
      await tx
        .update(usersTable)
        .set({
          passwordHash: await bcrypt.hash(record.password, 10),
          role: record.role,
          firstName: record.fullName,
          department: record.department,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, current.id));
      summary.updated++;
      if (profileUnchanged) summary.unchanged--;
    }
  }

  return summary;
}

export async function fetchDirectoryCsv(): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(DIRECTORY_CSV_URL, {
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Directory returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function syncUsersFromDirectory(csv?: string): Promise<UserSyncSummary> {
  const payload = csv ?? (await fetchDirectoryCsv());
  const parsed = parseDirectoryCsv(payload);
  const summary = emptyUserSyncSummary();
  // A header-only or blank directory is unsafe even though it has no
  // malformed data row to count. Surface it as one invalid result so every
  // caller takes the validation-failure path.
  summary.invalid =
    parsed.invalid.length ||
    (!parsed.safe && parsed.records.length === 0 && parsed.duplicates.length === 0 ? 1 : 0);
  summary.duplicates = parsed.duplicates.length;
  summary.errors = parsed.errors;

  if (!parsed.safe) {
    summary.skipped = parsed.invalid.length + parsed.duplicates.length;
    return summary;
  }

  const reconciled = await db.transaction((tx) =>
    reconcileUsersInTransaction(tx, parsed.records),
  );
  return { ...reconciled, invalid: 0, duplicates: 0, errors: parsed.errors };
}