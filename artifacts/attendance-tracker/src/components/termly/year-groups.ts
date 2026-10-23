export const ILP_YEAR_GROUPS = [7, 8, 9, 10, 11].map(year => `Year ${year}`);

export function canonicalYearGroup(value: string | null | undefined): string | null {
  const match = /^(?:(?:year|yr|y)\s*)?(7|8|9|10|11)$/i.exec(value?.trim() ?? "");
  return match ? `Year ${match[1]}` : null;
}

export function matchesYearGroup(value: string | null | undefined, selected: string) {
  return !selected || canonicalYearGroup(value) === selected;
}