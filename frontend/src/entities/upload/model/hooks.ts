import { useEffect, useMemo, useState } from "react";
import { api, type ListResponse } from "../../../shared/api/client";
import type { AnyRecord } from "../../types";
import { mapUploadLogEntry, mapUploadsToBatches, mapUploadToBatch } from "./adapters";

export function useUploads(limit = 50) {
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    void api<ListResponse<AnyRecord>>(`/uploads?limit=${limit}`)
      .then((data) => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [limit, reloadKey]);

  return {
    items,
    batches: useMemo(() => items.map(mapUploadToBatch), [items]),
    groupedBatches: useMemo(() => mapUploadsToBatches(items), [items]),
    loading,
    refetch: () => setReloadKey((key) => key + 1),
  };
}

export function useLatestUpload() {
  const { items, batches, loading } = useUploads(1);
  return { upload: items[0], batch: batches[0], loading };
}

export function useUploadLog(uploadId: string | undefined) {
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(uploadId));

  useEffect(() => {
    if (!uploadId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void api<ListResponse<AnyRecord> | AnyRecord[] | { processingLog?: AnyRecord[] }>(`/uploads/${uploadId}/log`)
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(data);
          return;
        }
        if ("processingLog" in data) {
          setItems(data.processingLog ?? []);
          return;
        }
        setItems("items" in data ? data.items : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [uploadId]);

  return { items, logEntries: useMemo(() => items.map(mapUploadLogEntry), [items]), loading };
}
