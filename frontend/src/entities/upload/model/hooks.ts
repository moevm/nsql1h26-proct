import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ListResponse } from "../../../shared/api/client";
import type { AnyRecord } from "../../types";
import { mapUploadLogEntry, mapUploadsToBatches, mapUploadToBatch } from "./adapters";
import type { ProcessingStatus, ProcessingStatusResponse } from "./types";

const activeProcessingStatuses = new Set<ProcessingStatus>(["queued", "processing", "cancelling"]);

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

export function useProcessingStatus(uploadId: string | undefined) {
  const [data, setData] = useState<ProcessingStatusResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(uploadId));
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const fetchStatus = useCallback(async () => {
    if (!uploadId) {
      setData(null);
      setLoading(false);
      return null;
    }

    if (!data) setLoading(true);
    setError("");
    try {
      const response = await api<ProcessingStatusResponse>(`/process/${uploadId}`);
      setData(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить состояние обработки");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [data, uploadId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus, reloadKey]);

  const status = data?.upload.processingState?.status;
  useEffect(() => {
    if (!uploadId || !status || !activeProcessingStatuses.has(status)) return undefined;
    const timer = window.setInterval(() => {
      void fetchStatus();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [fetchStatus, status, uploadId]);

  return {
    data,
    upload: data?.upload,
    processingLog: data?.processingLog ?? [],
    logEntries: useMemo(() => (data?.processingLog ?? []).map(mapUploadLogEntry), [data?.processingLog]),
    unresolvedStudents: data?.unresolvedStudents ?? [],
    loading,
    error,
    refetch: () => setReloadKey((key) => key + 1),
  };
}

function useProcessingMutation(pathBuilder: (uploadId: string) => string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (uploadId: string) => {
    if (!uploadId) return null;
    setLoading(true);
    setError("");
    try {
      return await api<ProcessingStatusResponse>(pathBuilder(uploadId), { method: "POST", body: "{}" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось выполнить действие";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pathBuilder]);

  return { run, loading, error };
}

export function useStartProcessing() {
  return useProcessingMutation((uploadId) => `/process/${uploadId}`);
}

export function useStopProcessing() {
  return useProcessingMutation((uploadId) => `/process/${uploadId}/stop`);
}

export function useRetryProcessing() {
  return useProcessingMutation((uploadId) => `/process/${uploadId}/retry`);
}
