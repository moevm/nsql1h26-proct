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

type CsvImportScopeState = {
  statuses: Record<CsvKind, UploadStatus>;
  results: Partial<Record<CsvKind, CsvImportResult>>;
};

type CsvImportStorageState = {
  transient: CsvImportScopeState;
  batches: Record<string, CsvImportScopeState>;
};

const initialStatuses: Record<CsvKind, UploadStatus> = {
  students: "empty",
  sessions: "empty",
  moodle_events: "empty",
  ocr_events: "empty",
};

const storageKey = "csv-import-state";

export function useCsvImport(activeBatchId?: string) {
  const [state, setState] = useState<CsvImportStorageState>(() => readSavedState());
  const [errors, setErrors] = useState<Record<string, Partial<Record<CsvKind, string>>>>({});
  const scopeKey = activeBatchId || "transient";
  const scopeState = getScopeState(state, activeBatchId);
  const scopeErrors = errors[scopeKey] ?? {};

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  async function uploadCsv(kind: CsvKind, file?: File, batchId?: string) {
    if (!file) return undefined;
    const formData = new FormData();
    formData.append("file", file);
    if (batchId) formData.append("batchId", batchId);
    setState((next) => updateScope(next, batchId, (scope) => ({ ...scope, statuses: { ...scope.statuses, [kind]: "uploading" } })));
    setErrors((next) => ({ ...next, [batchId || "transient"]: { ...(next[batchId || "transient"] ?? {}), [kind]: "" } }));

    try {
      const result = await api<CsvImportResult>(`/import/csv/${kind}`, { method: "POST", body: formData });
      setState((next) => {
        const updated = updateScope(next, result.importBatchId, (scope) => ({
          ...scope,
          results: { ...scope.results, [kind]: result },
          statuses: { ...scope.statuses, [kind]: "uploaded" },
        }));
        return batchId ? updated : { ...updated, transient: normalizeScope() };
      });
      return result;
    } catch (error) {
      setErrors((next) => ({ ...next, [batchId || "transient"]: { ...(next[batchId || "transient"] ?? {}), [kind]: error instanceof Error ? error.message : "Ошибка загрузки CSV" } }));
      setState((next) => updateScope(next, batchId, (scope) => ({ ...scope, statuses: { ...scope.statuses, [kind]: "error" } })));
      return undefined;
    }
  }

  function downloadTemplate(kind: CsvKind) {
    return downloadApiFile(`/import/templates/${kind}.csv`, `${kind}_template.csv`);
  }

  function resetImportState(options: { all?: boolean } = {}) {
    if (options.all) {
      setState(createEmptyState());
      setErrors({});
      return;
    }
    setState((next) => updateScope(next, activeBatchId, () => normalizeScope()));
    setErrors((next) => ({ ...next, [scopeKey]: {} }));
  }

  return { statuses: scopeState.statuses, results: scopeState.results, errors: scopeErrors, uploadCsv, downloadTemplate, resetImportState };
}

function readSavedState(): CsvImportStorageState {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw) as Partial<CsvImportStorageState> & { statuses?: Record<CsvKind, UploadStatus>; results?: Partial<Record<CsvKind, CsvImportResult>> };
    if (parsed.statuses || parsed.results) {
      return {
        transient: normalizeScope({ statuses: parsed.statuses, results: parsed.results }),
        batches: {},
      };
    }
    return {
      transient: normalizeScope(parsed.transient),
      batches: Object.fromEntries(Object.entries(parsed.batches ?? {}).map(([id, scope]) => [id, normalizeScope(scope)])),
    };
  } catch {
    return createEmptyState();
  }
}

function createEmptyState(): CsvImportStorageState {
  return { transient: normalizeScope(), batches: {} };
}

function normalizeScope(scope?: Partial<CsvImportScopeState>): CsvImportScopeState {
  return {
    statuses: { ...initialStatuses, ...(scope?.statuses ?? {}) },
    results: scope?.results ?? {},
  };
}

function getScopeState(state: CsvImportStorageState, batchId?: string): CsvImportScopeState {
  if (!batchId) return state.transient;
  return state.batches[batchId] ?? normalizeScope();
}

function updateScope(state: CsvImportStorageState, batchId: string | undefined, updater: (scope: CsvImportScopeState) => CsvImportScopeState): CsvImportStorageState {
  if (!batchId) {
    return { ...state, transient: updater(state.transient) };
  }
  return {
    ...state,
    batches: {
      ...state.batches,
      [batchId]: updater(state.batches[batchId] ?? normalizeScope()),
    },
  };
}
