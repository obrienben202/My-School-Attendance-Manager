export function normaliseStaffName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export type StaffIdentity = {
  displayName: string | null | undefined;
  username: string | null | undefined;
};

export function staffNameKey(name: string): string {
  return `name-${Buffer.from(normaliseStaffName(name)).toString("base64url")}`;
}

export function staffNamesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftName = normaliseStaffName(left);
  const rightName = normaliseStaffName(right);
  return !!leftName && !!rightName && leftName === rightName;
}

export function staffIdentityMatches(
  value: string | null | undefined,
  identity: StaffIdentity,
): boolean {
  return (
    staffNamesMatch(value, identity.displayName) ||
    staffNamesMatch(value, identity.username)
  );
}
