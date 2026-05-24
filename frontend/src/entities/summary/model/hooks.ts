import { useEffect, useState } from "react";
import { api, type ListResponse } from "../../../shared/api/client";
import type { AnyRecord } from "../../types";

type SummaryState = {
  total: number;
  first?: AnyRecord;
};

function useEntitySummary(path: string) {
  const [summary, setSummary] = useState<SummaryState>({ total: 0 });

  useEffect(() => {
    void api<ListResponse<AnyRecord>>(`${path}?limit=1`)
      .then((data) => setSummary({ total: Number(data.total ?? 0), first: data.items[0] }))
      .catch(() => setSummary({ total: 0 }));
  }, [path]);

  return summary;
}

export function useStudentsSummary() {
  return useEntitySummary("/students");
}

export function useSessionsSummary() {
  return useEntitySummary("/sessions");
}
