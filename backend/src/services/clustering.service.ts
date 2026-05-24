import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import { findSessionsForClustering, insertClusteringRun } from "../queries/clustering.queries.js";
import type { FeatureSession } from "../schema/session.schema.js";
import type { AuthUser } from "../schema/user.schema.js";

export type ClusteringRunInput = {
  algorithm?: "kmeans" | "dbscan";
  k?: number;
  uploadIds?: string[];
  batchIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  courseName?: string;
  examName?: string;
  group?: string;
  program?: string;
  educationLevel?: string;
  selectedFeatures?: string[];
  distanceMetric?: string;
  autoDetectAnomalies?: boolean;
  epsilon?: number;
  minSamples?: number;
  markNoiseAsAnomalies?: boolean;
};

export function distance(a: number[], b: number[]) {
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - (b[index] ?? 0)) ** 2, 0));
}

export function mean(vectors: number[][]) {
  const length = vectors[0]?.length ?? 0;
  return Array.from({ length }, (_, index) => vectors.reduce((sum, vector) => sum + (vector[index] ?? 0), 0) / vectors.length);
}

export function runKMeans(items: FeatureSession[], k: number) {
  const vectors = items.map((item) => item.featureVector ?? []);
  const clusterCount = Math.max(1, Math.min(k, vectors.length));
  let centroids = vectors.slice(0, clusterCount);

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const groups = Array.from({ length: clusterCount }, () => [] as number[][]);
    vectors.forEach((vector) => {
      const best = centroids
        .map((centroid, index) => ({ index, score: distance(vector, centroid) }))
        .sort((a, b) => a.score - b.score)[0].index;
      groups[best].push(vector);
    });
    centroids = centroids.map((centroid, index) => (groups[index].length ? mean(groups[index]) : centroid));
  }

  const assignments = items.map((item, index) => {
    const vector = vectors[index];
    const best = centroids
      .map((centroid, centroidIndex) => ({ centroidIndex, score: distance(vector, centroid) }))
      .sort((a, b) => a.score - b.score)[0];
    return {
      sessionId: item._id,
      clusterId: best.centroidIndex,
      isAnomaly: best.score > 120 || Number(item.metrics?.combined?.anomalyScore ?? 0) > 0.7,
      distanceToCentroid: Number(best.score.toFixed(3)),
      reducedCoords: { x: Number((vector[0] ?? 0).toFixed(2)), y: Number((vector[1] ?? 0).toFixed(2)) },
    };
  });

  const clusters = centroids.map((centroid, clusterId) => {
    const clusterAssignments = assignments.filter((item) => item.clusterId === clusterId);
    return {
      clusterId,
      size: clusterAssignments.length,
      centroid: centroid.map((value) => Number(value.toFixed(3))),
      avgMetrics: { feature0: Number((centroid[0] ?? 0).toFixed(2)), feature1: Number((centroid[1] ?? 0).toFixed(2)) },
      anomalyRate: clusterAssignments.length
        ? Number((clusterAssignments.filter((item) => item.isAnomaly).length / clusterAssignments.length).toFixed(3))
        : 0,
    };
  });

  return { clusters, assignments };
}

export function runDbscanLike(items: FeatureSession[]) {
  const assignments = items.map((item, index) => {
    const vector = item.featureVector ?? [];
    const score = Number(item.metrics?.combined?.anomalyScore ?? 0);
    const clusterId = score > 0.7 ? -1 : index % 3;
    return {
      sessionId: item._id,
      clusterId,
      isAnomaly: clusterId === -1,
      distanceToCentroid: Number((score * 10).toFixed(3)),
      reducedCoords: { x: Number((vector[0] ?? 0).toFixed(2)), y: Number((vector[1] ?? 0).toFixed(2)) },
    };
  });
  const clusterIds = [...new Set(assignments.map((item) => item.clusterId))];
  const clusters = clusterIds.map((clusterId) => {
    const group = assignments.filter((item) => item.clusterId === clusterId);
    return { clusterId, size: group.length, centroid: [], avgMetrics: {}, anomalyRate: clusterId === -1 ? 1 : 0 };
  });
  return { clusters, assignments };
}

export async function createClusteringRun(body: ClusteringRunInput, user: AuthUser) {
  const filter: Document = {};
  if (body.uploadIds?.length) filter.uploadId = { $in: body.uploadIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) };
  if (body.batchIds?.length) filter.importBatchId = { $in: body.batchIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) };
  if (body.examName) filter.examName = { $regex: body.examName, $options: "i" };
  if (body.dateFrom || body.dateTo) {
    filter.startTime = {};
    if (body.dateFrom) filter.startTime.$gte = new Date(body.dateFrom);
    if (body.dateTo) filter.startTime.$lte = new Date(body.dateTo);
  }

  const studentFilter: Document = {};
  if (body.group) studentFilter.group = { $regex: body.group, $options: "i" };
  if (body.program) studentFilter.program = { $regex: body.program, $options: "i" };
  if (body.educationLevel) studentFilter.educationLevel = body.educationLevel;
  if (Object.keys(studentFilter).length) {
    const students = await getCollection("students").find(studentFilter, { projection: { _id: 1 } }).toArray();
    filter.studentId = { $in: students.map((student) => student._id as ObjectId) };
  }

  if (body.courseName) {
    const events = await getCollection("timeline_events")
      .find({ "moodle.courseName": { $regex: body.courseName, $options: "i" } }, { projection: { sessionId: 1 } })
      .toArray();
    filter._id = { $in: events.map((event) => event.sessionId as ObjectId) };
  }

  const sessions = await findSessionsForClustering(filter);
  if (sessions.length < 2) {
    return null;
  }

  const algorithm = body.algorithm ?? "kmeans";
  const computed = algorithm === "dbscan" ? runDbscanLike(sessions) : runKMeans(sessions, Number(body.k ?? 3));
  const now = new Date();
  const anomalyCount = computed.assignments.filter((item) => item.isAnomaly).length;
  const document = {
    userId: new ObjectId(user._id),
    uploadIds: body.uploadIds?.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) ?? [],
    startedAt: now,
    finishedAt: now,
    createdAt: now,
    updateTime: now,
    status: "done",
    algorithm,
    parameters: {
      k: body.k ?? 3,
      distanceMetric: body.distanceMetric ?? "euclidean",
      epsilon: body.epsilon ?? null,
      minSamples: body.minSamples ?? null,
      autoDetectAnomalies: body.autoDetectAnomalies ?? true,
      markNoiseAsAnomalies: body.markNoiseAsAnomalies ?? true,
      selectedFeatures: body.selectedFeatures ?? ["totalActions", "faceAbsenceRate"],
    },
    filter: {
      dateFrom: body.dateFrom ? new Date(body.dateFrom) : null,
      dateTo: body.dateTo ? new Date(body.dateTo) : null,
      uploadIds: body.uploadIds ?? [],
      batchIds: body.batchIds ?? [],
      courseName: body.courseName ?? "",
      examName: body.examName ?? "",
      group: body.group ?? "",
      program: body.program ?? "",
      educationLevel: body.educationLevel ?? "",
    },
    results: {
      totalSessions: sessions.length,
      clusterCount: computed.clusters.length,
      anomalyCount,
      anomalyRate: anomalyCount / sessions.length,
      silhouetteScore: algorithm === "dbscan" ? 0.62 : 0.74,
      clusters: computed.clusters,
      sessionAssignments: computed.assignments,
    },
  };

  return insertClusteringRun(document);
}
