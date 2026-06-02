import { useEffect, useState } from "react";
import { api } from "../../../shared/api/client";
import type { AnyRecord } from "../../../entities/types";

export function useRunClustering() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnyRecord | undefined>();

  async function run(payload: AnyRecord) {
    setRunning(true);
    try {
      const data = await api<AnyRecord>("/clustering-runs/run", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(data);
      return data;
    } finally {
      setRunning(false);
    }
  }

  return { running, result, run };
}

export function useClusteringPreview(payload: AnyRecord) {
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(false);
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api<{ totalSessions: number }>("/clustering-runs/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then((data) => {
        if (!cancelled) setTotalSessions(Number(data.totalSessions ?? 0));
      })
      .catch(() => {
        if (!cancelled) setTotalSessions(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payloadKey]);

  return { totalSessions, loading };
}
