import { Router } from "express";
import { ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { deleteClusteringRun, getRunWithSessions } from "../queries/clustering.queries.js";
import type { AuthUser } from "../schema/user.schema.js";
import { recordRequestAuditEvent } from "../services/audit.service.js";
import { createClusteringRun, getClusteringPreview, type ClusteringRunInput } from "../services/clustering.service.js";
import { getQuery, serializeDocument } from "../utils/query.js";

export const clusteringRouter = Router();

function numericQuery(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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
    const data = await getRunWithSessions(String(req.params.runId), {
      sessionsPage: numericQuery(req.query.sessionsPage),
      sessionsLimit: numericQuery(req.query.sessionsLimit),
      clustersPage: numericQuery(req.query.clustersPage),
      clustersLimit: numericQuery(req.query.clustersLimit),
      sessionSearch: getQuery(req.query, "sessionSearch"),
      sessionCluster: getQuery(req.query, "sessionCluster"),
      sessionStatus: getQuery(req.query, "sessionStatus"),
      sessionDateFrom: getQuery(req.query, "sessionDateFrom"),
      sessionDateTo: getQuery(req.query, "sessionDateTo"),
      distanceMin: numericQuery(req.query.distanceMin),
      distanceMax: numericQuery(req.query.distanceMax),
      clusterId: getQuery(req.query, "clusterId"),
      clusterSizeMin: numericQuery(req.query.clusterSizeMin),
      clusterSizeMax: numericQuery(req.query.clusterSizeMax),
      clusterCentroid: getQuery(req.query, "clusterCentroid"),
      clusterAnomalyMin: numericQuery(req.query.clusterAnomalyMin),
      clusterAnomalyMax: numericQuery(req.query.clusterAnomalyMax),
    });
    if (!data) {
      res.status(404).json({ message: "Запуск не найден" });
      return;
    }

    res.json({
      run: serializeDocument(data.run),
      assignments: serializeDocument(data.assignments),
      clusters: serializeDocument(data.clusters),
      sessions: serializeDocument(data.sessions),
      students: serializeDocument(data.students),
      pagination: data.pagination,
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
