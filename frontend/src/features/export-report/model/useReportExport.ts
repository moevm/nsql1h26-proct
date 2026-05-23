import { downloadApiFile } from "../../../shared/api/client";

export type ReportExportKind = "anomalies" | "students" | "sessions";

export function useReportExport(runId: string) {
  function download(kind: ReportExportKind) {
    if (kind === "students" || kind === "sessions") {
      return downloadApiFile(`/reports/${kind}.json`, `${kind}.json`);
    }

    const query = runId ? `?runId=${runId}` : "";
    const fileName = `${kind}.csv`;
    return downloadApiFile(`/reports/anomalies.csv${query}`, fileName);
  }

  return { download };
}
