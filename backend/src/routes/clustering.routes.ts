import { Router } from "express";
import { ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { deleteClusteringRun, getRunWithSessions } from "../queries/clustering.queries.js";
import type { AuthUser } from "../schema/user.schema.js";
import { recordRequestAuditEvent } from "../services/audit.service.js";
import { createClusteringRun, getClusteringPreview, type ClusteringRunInput } from "../services/clustering.service.js";
import { serializeDocument } from "../utils/query.js";

export const clusteringRouter = Router();

clusteringRouter.post(
  "/clustering-runs/preview",
  auth,
  asyncHandler(async (req, res) => {
    const input = req.body as ClusteringRunInput;
    const preview = await getClusteringPreview(input);
    res.json(preview);
  }),
);

clusteringRouter.post(
  "/clustering-runs/run",
  auth,
  asyncHandler(async (req, res) => {
    const user = res.locals.user as AuthUser;
    const input = req.body as ClusteringRunInput;
    const insertedId = await createClusteringRun(input, user);
    if (!insertedId) {
      res.status(400).json({ message: "Недостаточно сессий для кластеризации" });
      return;
    }

    const run = await getCollection("clustering_runs").findOne({ _id: insertedId });
    await recordRequestAuditEvent(req, user, {
      action: "clustering_run.create",
      entityType: "clustering_run",
      entityId: insertedId,
      after: run,
      details: {
        algorithm: run?.algorithm ?? input.algorithm ?? "kmeans",
        totalSessions: (run?.results as Record<string, unknown> | undefined)?.totalSessions,
        anomalyCount: (run?.results as Record<string, unknown> | undefined)?.anomalyCount,
      },
    });

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
    const runId = String(req.params.runId);
    const before = ObjectId.isValid(runId) ? await getCollection("clustering_runs").findOne({ _id: new ObjectId(runId) }) : null;
    const deleted = await deleteClusteringRun(runId);
    if (!deleted) {
      res.status(404).json({ message: "Запуск не найден" });
      return;
    }

    await recordRequestAuditEvent(req, res.locals.user as AuthUser, {
      action: "clustering_run.delete",
      entityType: "clustering_run",
      entityId: runId,
      before,
      details: {
        algorithm: before?.algorithm,
        totalSessions: (before?.results as Record<string, unknown> | undefined)?.totalSessions,
        anomalyCount: (before?.results as Record<string, unknown> | undefined)?.anomalyCount,
      },
    });

    res.status(204).send();
  }),
);
