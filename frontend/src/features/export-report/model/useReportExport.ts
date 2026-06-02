import { buildQuery, downloadApiFile } from "../../../shared/api/client";

export type ReportExportKind = "anomalies" | "students" | "sessions";
export type ReportExportFormat = "json" | "csv";

export type ReportExportParams = {
  kind: ReportExportKind;
  format: ReportExportFormat;
  runId?: string;
  dateFrom?: string;
  dateTo?: string;
  clusterId?: string;
  onlyAnomalies?: boolean;
  includeRawMetrics?: boolean;
  includeStudents?: boolean;
};

function addParam(params: URLSearchParams, key: string, value: string | boolean | undefined) {
  if (value === undefined || value === "" || value === false) return;
  params.set(key, String(value));
}

export function useReportExport() {
  function download(options: ReportExportParams) {
    const params = new URLSearchParams();
    addParam(params, "runId", options.runId);
    addParam(params, "dateFrom", options.dateFrom);
    addParam(params, "dateTo", options.dateTo);
    addParam(params, "clusterId", options.clusterId === "all" ? undefined : options.clusterId);
    addParam(params, "onlyAnomalies", options.onlyAnomalies);
    addParam(params, "includeRawMetrics", options.includeRawMetrics);
    addParam(params, "includeStudents", options.includeStudents);

    const query = buildQuery(params);
    const fileName = `${options.kind}-report.${options.format}`;
    return downloadApiFile(`/reports/${options.kind}.${options.format}${query}`, fileName);
  }

  return { download };
}
