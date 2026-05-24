import { Router } from "express";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { buildAnomaliesCsv, buildSessionsJsonExport, buildStudentsJsonExport } from "../services/report.service.js";
import { getQuery } from "../utils/query.js";

export const reportsRouter = Router();

reportsRouter.get(
  "/reports/anomalies.csv",
  auth,
  asyncHandler(async (req, res) => {
    const csv = await buildAnomaliesCsv(getQuery(req.query, "runId"));
    if (!csv) {
      res.status(404).send("No clustering runs");
      return;
    }

    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("anomalies.csv");
    res.send(csv);
  }),
);

reportsRouter.get(
  "/reports/students.json",
  auth,
  asyncHandler(async (_req, res) => {
    res.header("Content-Type", "application/json; charset=utf-8");
    res.attachment("students.json");
    res.json(await buildStudentsJsonExport());
  }),
);

reportsRouter.get(
  "/reports/sessions.json",
  auth,
  asyncHandler(async (_req, res) => {
    res.header("Content-Type", "application/json; charset=utf-8");
    res.attachment("sessions.json");
    res.json(await buildSessionsJsonExport());
  }),
);
