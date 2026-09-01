export type RegisterListState =
  | "loading"
  | "error"
  | "no-assigned-lessons"
  | "filter-empty"
  | "ready";

type RegisterListStateInput = {
  isLoading: boolean;
  isError: boolean;
  registerCount: number;
  filteredCount: number;
};

export function resolveRegisterListState({
  isLoading,
  isError,
  registerCount,
  filteredCount,
}: RegisterListStateInput): RegisterListState {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (registerCount === 0) return "no-assigned-lessons";
  if (filteredCount === 0) return "filter-empty";
  return "ready";
}

export function hasOnlyEmptyRosters(
  registers: Array<{ enrolled: number }>,
): boolean {
  return registers.length > 0 && registers.every(register => register.enrolled === 0);
}