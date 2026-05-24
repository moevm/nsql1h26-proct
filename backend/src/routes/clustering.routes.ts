import { Router } from "express";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { deleteClusteringRun, getRunWithSessions } from "../queries/clustering.queries.js";
import type { AuthUser } from "../schema/user.schema.js";
import { createClusteringRun, type ClusteringRunInput } from "../services/clustering.service.js";
import { serializeDocument } from "../utils/query.js";

export const clusteringRouter = Router();

clusteringRouter.post(
  "/clustering-runs/run",
  auth,
  asyncHandler(async (req, res) => {
    const insertedId = await createClusteringRun(req.body as ClusteringRunInput, res.locals.user as AuthUser);
    if (!insertedId) {
      res.status(400).json({ message: "Недостаточно сессий для кластеризации" });
      return;
    }

    res.status(201).json({ _id: insertedId });
  }),
);

clusteringRouter.get(
  "/results/:runId",
  auth,
  asyncHandler(async (req, res) => {
    const data = await getRunWithSessions(String(req.params.runId));
    if (!data) {
      res.status(404).json({ message: "Запуск не найден" });
      return;
    }

    res.json({
      run: serializeDocument(data.run),
      sessions: serializeDocument(data.sessions),
      students: serializeDocument(data.students),
    });
  }),
);

clusteringRouter.delete(
  "/clustering-runs/:runId",
  auth,
  asyncHandler(async (req, res) => {
    const deleted = await deleteClusteringRun(String(req.params.runId));
    if (!deleted) {
      res.status(404).json({ message: "Запуск не найден" });
      return;
    }

    res.status(204).send();
  }),
);
