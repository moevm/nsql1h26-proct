import { getAnomalyRows, getSessionsExportRows, getStudentsExportRows } from "../queries/report.queries.js";
import { makeCsv } from "../utils/csv.js";

export async function buildAnomaliesCsv(runId?: string) {
  const rows = await getAnomalyRows(runId);
  if (!rows) return null;
  return makeCsv(rows);
}

export async function buildStudentsJsonExport() {
  return getStudentsExportRows();
}

export async function buildSessionsJsonExport() {
  return getSessionsExportRows();
}
