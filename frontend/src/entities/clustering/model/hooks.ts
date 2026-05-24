import { useEffect, useMemo, useState } from "react";
import { api, type ListResponse } from "../../../shared/api/client";
import type { AnyRecord } from "../../types";
import { mapResultToSessionRows, mapRunToHistoryRow } from "./adapters";

export function useClusteringRuns(limit = 50) {
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    void api<ListResponse<AnyRecord>>(`/clustering-runs?limit=${limit}`)
      .then((data) => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [limit, reloadKey]);

  async function deleteRun(runId: string) {
    await api(`/clustering-runs/${runId}`, { method: "DELETE" });
    setItems((current) => current.filter((item) => String(item._id) !== runId));
    setReloadKey((key) => key + 1);
  }

  return { items, runs: useMemo(() => items.map(mapRunToHistoryRow), [items]), loading, deleteRun, refetch: () => setReloadKey((key) => key + 1) };
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
