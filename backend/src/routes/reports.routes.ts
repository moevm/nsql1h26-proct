import { Router } from "express";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { normalizeReportKind, type ReportFilters } from "../queries/report.queries.js";
import type { AuthUser } from "../schema/user.schema.js";
import { recordRequestAuditEvent } from "../services/audit.service.js";
import { buildReportCsvExport, buildReportJsonExport } from "../services/report.service.js";
import { getQuery, type QuerySource } from "../utils/query.js";

export const reportsRouter = Router();

function parseBoolean(value: string | undefined) {
  if (value === undefined) return undefined;
  return value === "true" || value === "1" || value === "yes";
}

function buildReportFilters(query: QuerySource): ReportFilters {
  return {
    runId: getQuery(query, "runId"),
    dateFrom: getQuery(query, "dateFrom"),
    dateTo: getQuery(query, "dateTo"),
    clusterId: getQuery(query, "clusterId"),
    onlyAnomalies: parseBoolean(getQuery(query, "onlyAnomalies")),
    includeRawMetrics: parseBoolean(getQuery(query, "includeRawMetrics")),
    includeStudents: parseBoolean(getQuery(query, "includeStudents")),
  };
}

reportsRouter.get(
  "/reports/:kind.:format",
  auth,
  asyncHandler(async (req, res) => {
    const kind = normalizeReportKind(String(req.params.kind));
    const format = String(req.params.format);
    if (!kind || (format !== "json" && format !== "csv")) {
      res.status(400).json({ message: "Неподдерживаемый формат отчета" });
      return;
    }

    const user = res.locals.user as AuthUser;
    const filters = buildReportFilters(req.query);

    if (format === "json") {
      const payload = await buildReportJsonExport(kind, filters, user);
      if (!payload) {
        res.status(404).json({ message: "Нет доступных запусков кластеризации для отчета" });
        return;
      }

      await recordRequestAuditEvent(req, user, {
        action: "report.export",
        entityType: "report",
        details: { report: `${kind}.json`, format, kind, runId: payload.meta.runId, filters, count: payload.total },
      });

      res.header("Content-Type", "application/json; charset=utf-8");
      res.attachment(`${kind}-report.json`);
      res.json(payload);
      return;
    }

    const result = await buildReportCsvExport(kind, filters, user);
    if (!result) {
      res.status(404).send("No clustering runs");
      return;
    }

    await recordRequestAuditEvent(req, res.locals.user as AuthUser, {
      action: "report.export",
      entityType: "report",
      details: { report: `${kind}.csv`, format, kind, runId: result.payload.meta.runId, filters, count: result.payload.total },
    });

    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment(`${kind}-report.csv`);
    res.send(result.csv);
  }),
);
