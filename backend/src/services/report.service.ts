import { buildReportPayload, type ReportFilters, type ReportKind } from "../queries/report.queries.js";
import type { AuthUser } from "../schema/user.schema.js";
import { makeCsv } from "../utils/csv.js";

export async function buildReportJsonExport(kind: ReportKind, filters: ReportFilters, user: AuthUser) {
  return buildReportPayload(kind, filters, user);
}

export async function buildReportCsvExport(kind: ReportKind, filters: ReportFilters, user: AuthUser) {
  const payload = await buildReportPayload(kind, filters, user);
  if (!payload) return null;
  return { payload, csv: makeCsv(payload.items) };
}
