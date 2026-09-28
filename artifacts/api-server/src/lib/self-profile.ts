import { normalizeDirectoryUsername, parseCsv, parseDirectoryCsv } from "./user-directory";

export type DirectoryProfile = {
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  staffCode: string | null;
  jobTitle: string | null;
  organisation: string | null;
  startDate: string | null;
};

export type ProfileSource = {
  profile: DirectoryProfile | null;
  directoryStatus: "fresh" | "stale" | "missing";
  directoryVerifiedAt: string | null;
};

// Keep only selected fields, never the directory CSV (which includes passwords).
// This cache is process-local, bounded, and scoped to both account ID and username.
const FRESH_MS = 5 * 60_000;
const MAX_STALE_MS = 24 * 60 * 60_000;
const MAX_ENTRIES = 500;

export function createSelfProfileCache(loadCsv: () => Promise<string>, now: () => number = Date.now) {
  const entries = new Map<string, { username: string; profile: DirectoryProfile; verifiedAt: number }>();

  return async (accountId: string, username: string): Promise<ProfileSource> => {
    const identity = normalizeDirectoryUsername(username);
    const currentTime = now();
    for (const [id, entry] of entries) {
      if (currentTime - entry.verifiedAt > MAX_STALE_MS) entries.delete(id);
    }
    const existing = entries.get(accountId);
    if (existing && existing.username !== identity) entries.delete(accountId);
    const cached = existing?.username === identity ? entries.get(accountId) : undefined;
    const result = (entry: typeof cached, directoryStatus: "fresh" | "stale"): ProfileSource => ({
      profile: entry!.profile,
      directoryStatus,
      directoryVerifiedAt: new Date(entry!.verifiedAt).toISOString(),
    });

    if (cached && currentTime - cached.verifiedAt < FRESH_MS) return result(cached, "fresh");

    let csv: string;
    try {
      csv = await loadCsv();
    } catch {
      if (cached && now() - cached.verifiedAt <= MAX_STALE_MS) return result(cached, "stale");
      throw new Error("Directory fetch failed and no recent verified profile is available");
    }

    // Validation errors are not outages. They must never be mistaken for an
    // absent record or used to refresh the cache.
    const profile = profileForUsername(csv, identity);
    if (!profile) {
      entries.delete(accountId);
      return { profile: null, directoryStatus: "missing", directoryVerifiedAt: null };
    }
    const verifiedAt = now();
    const entry = { username: identity, profile, verifiedAt };
    entries.delete(accountId);
    entries.set(accountId, entry);
    if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    return result(entry, "fresh");
  };
}

function key(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function column(headers: string[], aliases: string[]) {
  const allowed = new Set(aliases.map(key));
  return headers.findIndex(header => allowed.has(key(header)));
}

function validDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value : null;
}

// Read only explicitly named columns for the exact authenticated username.
// Never include password or arbitrary sheet columns in the response.
export function profileForUsername(csv: string, username: string): DirectoryProfile | null {
  const parsed = parseDirectoryCsv(csv);
  if (!parsed.safe) throw new Error("Directory profile source is invalid");
  const rows = parseCsv(csv);
  const headers = rows[0];
  const userColumn = column(headers, ["username", "user", "user name", "login"]);
  const matches = rows.slice(1).filter(row => normalizeDirectoryUsername(row[userColumn] ?? "") === normalizeDirectoryUsername(username));
  if (matches.length !== 1) return null;
  const row = matches[0];
  const value = (...aliases: string[]) => {
    const index = column(headers, aliases);
    return index < 0 ? null : row[index]?.trim() || null;
  };
  const email = value("email", "email address", "work email");
  return {
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    phone: value("phone", "phone number", "telephone", "contact number"),
    address: value("address", "home address"),
    postcode: value("postcode", "postal code", "zip code"),
    staffCode: value("staff code", "staff id", "employee number"),
    jobTitle: value("job title", "position"),
    organisation: value("organisation", "organization", "employer"),
    startDate: validDate(value("start date", "employment start date")),
  };
}