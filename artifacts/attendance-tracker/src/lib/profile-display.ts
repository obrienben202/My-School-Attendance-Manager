// A failed refetch can retain the last successful React Query data. Directory
// contact information must not remain visible after the server rejects it.
export function displayAccountEmail(
  accountEmail: string | null | undefined,
  directoryEmail: string | null | undefined,
  profileError: boolean,
): string | null {
  return profileError ? accountEmail ?? null : accountEmail ?? directoryEmail ?? null;
}