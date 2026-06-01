import { Router } from "express";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { AuthUser } from "../schema/user.schema.js";
import { recordRequestAuditEvent } from "../services/audit.service.js";
import { buildAnomaliesCsv, buildSessionsJsonExport, buildStudentsJsonExport } from "../services/report.service.js";
import { getQuery } from "../utils/query.js";

export const reportsRouter = Router();

reportsRouter.get(
  "/reports/anomalies.csv",
  auth,
  asyncHandler(async (req, res) => {
    const runId = getQuery(req.query, "runId");
    const csv = await buildAnomaliesCsv(runId);
    if (!csv) {
      res.status(404).send("No clustering runs");
      return;
    }

    await recordRequestAuditEvent(req, res.locals.user as AuthUser, {
      action: "report.export",
      entityType: "report",
      details: { report: "anomalies.csv", runId: runId ?? null },
    });

    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("anomalies.csv");
    res.send(csv);
  }),
);

reportsRouter.get(
  "/reports/students.json",
  auth,
  asyncHandler(async (req, res) => {
    const payload = await buildStudentsJsonExport();
    await recordRequestAuditEvent(req, res.locals.user as AuthUser, {
      action: "report.export",
      entityType: "report",
      details: { report: "students.json", count: payload.length },
    });

    res.header("Content-Type", "application/json; charset=utf-8");
    res.attachment("students.json");
    res.json(payload);
  }),
);

reportsRouter.get(
  "/reports/sessions.json",
  auth,
  asyncHandler(async (req, res) => {
    const payload = await buildSessionsJsonExport();
    await recordRequestAuditEvent(req, res.locals.user as AuthUser, {
      action: "report.export",
      entityType: "report",
      details: { report: "sessions.json", count: payload.length },
    });

    res.header("Content-Type", "application/json; charset=utf-8");
    res.attachment("sessions.json");
    res.json(payload);
  }),
);
