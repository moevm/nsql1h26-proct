import { useEffect, useMemo, useState } from "react";
import { readStoredPageSize, writeStoredPageSize } from "./paginationStorage";

export function useClientPagination<T>(items: T[], initialLimit = 10, storageKey?: string) {
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(() => readStoredPageSize(storageKey, initialLimit));
  const totalPages = Math.max(1, Math.ceil(items.length / Math.max(1, limit)));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * limit;
    return items.slice(start, start + limit);
  }, [items, limit, safePage]);

  function setLimit(nextLimit: number) {
    const safeLimit = Math.max(1, nextLimit);
    setLimitState(safeLimit);
    writeStoredPageSize(storageKey, safeLimit);
    setPage(1);
  }

  return {
    page: safePage,
    limit,
    setPage,
    setLimit,
    paginatedItems,
    total: items.length,
    totalPages,
  };
}
