import { useEffect, useState } from "react";
import { api, downloadApiFile } from "../../../shared/api/client";
import type { CsvKind } from "../config/csvImportConfig";

export type UploadStatus = "empty" | "uploading" | "uploaded" | "error";

export type CsvImportResult = {
  uploadId: string;
  importBatchId: string;
  kind: CsvKind;
  totalRows: number;
  insertedCount: number;
  errorCount: number;
  errors: Array<{ line: number; message: string }>;
};

const initialStatuses: Record<CsvKind, UploadStatus> = {
  students: "empty",
  sessions: "empty",
  moodle_events: "empty",
  ocr_events: "empty",
};

const storageKey = "csv-import-state";

export function useCsvImport() {
  const saved = readSavedState();
  const [statuses, setStatuses] = useState<Record<CsvKind, UploadStatus>>(saved.statuses);
  const [results, setResults] = useState<Partial<Record<CsvKind, CsvImportResult>>>(saved.results);
  const [errors, setErrors] = useState<Partial<Record<CsvKind, string>>>({});

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ statuses, results }));
  }, [results, statuses]);

  async function uploadCsv(kind: CsvKind, file?: File, batchId?: string) {
    if (!file) return undefined;
    const formData = new FormData();
    formData.append("file", file);
    if (batchId) formData.append("batchId", batchId);
    setStatuses((next) => ({ ...next, [kind]: "uploading" }));
    setErrors((next) => ({ ...next, [kind]: "" }));

    try {
      const result = await api<CsvImportResult>(`/import/csv/${kind}`, { method: "POST", body: formData });
      setResults((next) => ({ ...next, [kind]: result }));
      setStatuses((next) => ({ ...next, [kind]: "uploaded" }));
      return result;
    } catch (error) {
      setErrors((next) => ({ ...next, [kind]: error instanceof Error ? error.message : "Ошибка загрузки CSV" }));
      setStatuses((next) => ({ ...next, [kind]: "error" }));
      return undefined;
    }
  }

  function downloadTemplate(kind: CsvKind) {
    return downloadApiFile(`/import/templates/${kind}.csv`, `${kind}_template.csv`);
  }

  return { statuses, results, errors, uploadCsv, downloadTemplate };
}

function readSavedState() {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return { statuses: initialStatuses, results: {} };
    const parsed = JSON.parse(raw) as { statuses?: Record<CsvKind, UploadStatus>; results?: Partial<Record<CsvKind, CsvImportResult>> };
    return { statuses: parsed.statuses ?? initialStatuses, results: parsed.results ?? {} };
  } catch {
    return { statuses: initialStatuses, results: {} };
  }
}
