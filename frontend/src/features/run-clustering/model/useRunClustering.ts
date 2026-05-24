import { useState } from "react";
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
