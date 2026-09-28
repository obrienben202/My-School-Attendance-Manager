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

const emptyProfile = (): DirectoryProfile => ({
  email: null, phone: null, address: null, postcode: null,
  staffCode: null, jobTitle: null, organisation: null, startDate: null,
});

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
export function profileForUsername(csv: string, username: string): DirectoryProfile {
  const parsed = parseDirectoryCsv(csv);
  if (!parsed.safe) throw new Error("Directory profile source is invalid");
  const rows = parseCsv(csv);
  const headers = rows[0];
  const userColumn = column(headers, ["username", "user", "user name", "login"]);
  const matches = rows.slice(1).filter(row => normalizeDirectoryUsername(row[userColumn] ?? "") === normalizeDirectoryUsername(username));
  if (matches.length !== 1) return emptyProfile();
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