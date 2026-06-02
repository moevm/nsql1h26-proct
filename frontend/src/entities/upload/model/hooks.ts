import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type ListResponse } from "../../../shared/api/client";
import type { AnyRecord } from "../../types";
import { activeProcessingStatuses, mapUploadLogEntry, mapUploadsToBatches, mapUploadToBatch } from "./adapters";
import type { ProcessingStatusResponse } from "./types";

type PaginationOptions = number | { page?: number; limit?: number };

function paginationOptions(options: PaginationOptions = 50) {
  if (typeof options === "number") return { page: 1, limit: options };
  return { page: options.page ?? 1, limit: options.limit ?? 50 };
}

export function useUploads(options: PaginationOptions = 50) {
  const { page, limit } = paginationOptions(options);
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [meta, setMeta] = useState({ total: 0, page, limit });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    void api<ListResponse<AnyRecord>>(`/uploads?page=${page}&limit=${limit}`)
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

  return {
    items,
    batches: useMemo(() => items.map(mapUploadToBatch), [items]),
    groupedBatches: useMemo(() => mapUploadsToBatches(items), [items]),
    total: meta.total,
    page: meta.page,
    limit: meta.limit,
    loading,
    refetch: () => setReloadKey((key) => key + 1),
  };
}

export function useLatestUpload() {
  const { items, batches, loading } = useUploads({ limit: 1 });
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
  const inFlightRef = useRef(false);
  const loadedUploadIdRef = useRef<string | undefined>(undefined);

  const fetchStatus = useCallback(async () => {
    if (!uploadId) {
      setData(null);
      setLoading(false);
      loadedUploadIdRef.current = undefined;
      return null;
    }

    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    if (loadedUploadIdRef.current !== uploadId) setLoading(true);
    setError("");
    try {
      const response = await api<ProcessingStatusResponse>(`/process/${uploadId}`);
      setData(response);
      loadedUploadIdRef.current = uploadId;
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить состояние обработки");
      setData(null);
      return null;
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [uploadId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus, reloadKey]);

  const status = data?.upload.processingState?.status;
  useEffect(() => {
    if (!uploadId || !status || !activeProcessingStatuses.has(status)) return undefined;
    const timer = window.setInterval(() => {
      void fetchStatus();
    }, 3000);
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
