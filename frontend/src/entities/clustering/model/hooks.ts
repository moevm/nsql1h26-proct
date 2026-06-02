import { useEffect, useMemo, useState } from "react";
import { api, type ListResponse } from "../../../shared/api/client";
import type { AnyRecord } from "../../types";
import { mapResultToSessionRows, mapRunToHistoryRow } from "./adapters";

type PaginationOptions = number | { page?: number; limit?: number };

function paginationOptions(options: PaginationOptions = 50) {
  if (typeof options === "number") return { page: 1, limit: options };
  return { page: options.page ?? 1, limit: options.limit ?? 50 };
}

export function useClusteringRuns(options: PaginationOptions = 50) {
  const { page, limit } = paginationOptions(options);
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [meta, setMeta] = useState({ total: 0, page, limit });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    void api<ListResponse<AnyRecord>>(`/clustering-runs?page=${page}&limit=${limit}`)
      .then((data) => {
        setItems(data.items);
        setMeta({ total: data.total, page: data.page, limit: data.limit });
      })
      .catch(() => {
        setItems([]);
        setMeta({ total: 0, page, limit });
      })
      .finally(() => setLoading(false));
  }, [limit, page, reloadKey]);

  async function deleteRun(runId: string) {
    await api(`/clustering-runs/${runId}`, { method: "DELETE" });
    setItems((current) => current.filter((item) => String(item._id) !== runId));
    setReloadKey((key) => key + 1);
  }

  return { items, runs: useMemo(() => items.map(mapRunToHistoryRow), [items]), total: meta.total, page: meta.page, limit: meta.limit, loading, deleteRun, refetch: () => setReloadKey((key) => key + 1) };
}

export function useClusteringResult(runId: string | undefined) {
  const [result, setResult] = useState<AnyRecord | undefined>();
  const [loading, setLoading] = useState(Boolean(runId));

  useEffect(() => {
    if (!runId) {
      setResult(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    void api<AnyRecord>(`/results/${runId}`)
      .then(setResult)
      .catch(() => setResult(undefined))
      .finally(() => setLoading(false));
  }, [runId]);

  return { result, sessions: useMemo(() => mapResultToSessionRows(result), [result]), loading };
}
