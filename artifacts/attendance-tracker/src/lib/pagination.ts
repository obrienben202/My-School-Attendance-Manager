export function getPagination(totalItems: number, requestedPage: number, pageSize: number) {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("Page size must be a positive integer.");
  }
  const safeTotal = Math.max(0, totalItems);
  const totalPages = Math.ceil(safeTotal / pageSize);
  const currentPage = Math.min(Math.max(0, requestedPage), Math.max(0, totalPages - 1));
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, safeTotal);

  return {
    totalPages,
    currentPage,
    startIndex,
    endIndex,
    canGoPrevious: currentPage > 0,
    canGoNext: currentPage < totalPages - 1,
  };
}