import type { IlpGroupFilter } from "@workspace/db";

export function groupMatchesYear(filters: IlpGroupFilter[], year: string | null): boolean {
  // Missing/out-of-scope roster years must not become matches for negative filters.
  const normalized = year?.trim().replace(/^Year\s+/i, "") ?? "";
  if (!/^(7|8|9|10|11)$/.test(normalized)) return false;
  return filters.every(filter => {
    const equal = normalized === filter.value.replace(/^Year /, "");
    return filter.operator === "equals" ? equal : !equal;
  });
}