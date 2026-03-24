import { useState, useMemo } from 'react';

const PAGE_SIZE = 20;

export function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  // Reset to page 1 when total changes significantly (e.g. after filtering)
  const reset = () => setPage(1);

  return {
    paged,
    page: safePage,
    totalPages,
    totalItems: items.length,
    pageSize,
    setPage,
    reset,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}
