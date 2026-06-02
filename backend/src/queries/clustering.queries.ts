import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { FeatureSession } from "../schema/session.schema.js";

export function findSessionsForClustering(filter: Document) {
  return getCollection("sessions").find(filter).toArray() as Promise<FeatureSession[]>;
}

export async function insertClusteringRun(document: Document) {
  const result = await getCollection("clustering_runs").insertOne(document);
  return result.insertedId;
}

type ResultPaginationOptions = {
  sessionsPage?: number;
  sessionsLimit?: number;
  clustersPage?: number;
  clustersLimit?: number;
  sessionSearch?: string;
  sessionCluster?: string;
  sessionStatus?: string;
  sessionDateFrom?: string;
  sessionDateTo?: string;
  distanceMin?: number;
  distanceMax?: number;
  clusterId?: string;
  clusterSizeMin?: number;
  clusterSizeMax?: number;
  clusterCentroid?: string;
  clusterAnomalyMin?: number;
  clusterAnomalyMax?: number;
};

function safePagination(page = 1, limit = 10) {
  return {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(limit, 200)),
  };
}

function clusterLabel(clusterId: unknown) {
  const value = Number(clusterId);
  if (!Number.isFinite(value)) return "—";
  return value < 0 ? "noise" : `C${value + 1}`;
}

function matchesText(value: unknown, query: string | undefined) {
  return !query || String(value ?? "").toLowerCase().includes(query.toLowerCase());
}

function matchesRange(value: unknown, min: number | undefined, max: number | undefined) {
  const numeric = Number(value ?? 0);
  return numeric >= (min ?? Number.NEGATIVE_INFINITY) && numeric <= (max ?? Number.POSITIVE_INFINITY);
}

function matchesDate(value: unknown, from: string | undefined, to: string | undefined) {
  const timestamp = value ? new Date(String(value)).getTime() : Number.NaN;
  const fromTime = from ? new Date(from).getTime() : Number.NEGATIVE_INFINITY;
  const toTime = to ? new Date(to).getTime() : Number.POSITIVE_INFINITY;
  if (Number.isNaN(timestamp)) return !from && !to;
  return timestamp >= fromTime && timestamp <= toTime;
}

function pageSlice<T>(items: T[], page: number, limit: number) {
  return items.slice((page - 1) * limit, page * limit);
}

export async function getRunWithSessions(runId: string, options: ResultPaginationOptions = {}) {
  if (!ObjectId.isValid(runId)) return null;
  const run = await getCollection("clustering_runs").findOne({ _id: new ObjectId(runId) });
  if (!run) return null;

  const sessionPagination = safePagination(options.sessionsPage, options.sessionsLimit ?? 15);
  const clusterPagination = safePagination(options.clustersPage, options.clustersLimit ?? 10);
  const assignments = ((run.results as Document)?.sessionAssignments as Document[] | undefined) ?? [];
  const allSessionIds = assignments.map((item) => item.sessionId as ObjectId).filter(Boolean);
  const allSessions = await getCollection("sessions").find({ _id: { $in: allSessionIds } }).toArray();
  const allStudentIds = allSessions.map((session) => session.studentId as ObjectId).filter(Boolean);
  const allStudents = await getCollection("students").find({ _id: { $in: allStudentIds } }).toArray();
  const sessionsById = new Map(allSessions.map((session) => [String(session._id), session]));
  const studentsById = new Map(allStudents.map((student) => [String(student._id), student]));

  const filteredAssignments = assignments.filter((assignment) => {
    const session = sessionsById.get(String(assignment.sessionId));
    const student = studentsById.get(String(session?.studentId ?? ""));
    const label = clusterLabel(assignment.clusterId);
    return (
      matchesText(student?.fullName ?? session?.studentId ?? assignment.sessionId, options.sessionSearch) &&
      (!options.sessionCluster || options.sessionCluster === "all" || label === options.sessionCluster) &&
      (!options.sessionStatus || options.sessionStatus === "all" || (options.sessionStatus === "anomaly" ? Boolean(assignment.isAnomaly) : !assignment.isAnomaly)) &&
      matchesDate(session?.startTime, options.sessionDateFrom, options.sessionDateTo) &&
      matchesRange(assignment.distanceToCentroid, options.distanceMin, options.distanceMax)
    );
  });

  const pagedAssignments = pageSlice(filteredAssignments, sessionPagination.page, sessionPagination.limit);
  const pagedSessionIds = pagedAssignments.map((item) => item.sessionId as ObjectId).filter(Boolean);
  const sessions = allSessions.filter((session) => pagedSessionIds.some((id) => String(id) === String(session._id)));
  const studentIds = sessions.map((session) => session.studentId as ObjectId).filter(Boolean);
  const students = await getCollection("students").find({ _id: { $in: studentIds } }).toArray();

  const clusters = ((run.results as Document)?.clusters as Document[] | undefined) ?? [];
  const filteredClusters = clusters.filter((cluster, index) => {
    const label = clusterLabel(cluster.clusterId ?? index);
    const centroid = Array.isArray(cluster.centroid) ? cluster.centroid.slice(0, 3).join(", ") : "—";
    const anomalyRate = Number(cluster.anomalyRate ?? 0) * 100;
    return (
      matchesText(label, options.clusterId) &&
      matchesRange(cluster.size, options.clusterSizeMin, options.clusterSizeMax) &&
      matchesText(centroid, options.clusterCentroid) &&
      matchesRange(anomalyRate, options.clusterAnomalyMin, options.clusterAnomalyMax)
    );
  });
  const pagedClusters = pageSlice(filteredClusters, clusterPagination.page, clusterPagination.limit);

  return {
    run,
    assignments: pagedAssignments,
    clusters: pagedClusters,
    sessions,
    students,
    pagination: {
      sessions: { total: filteredAssignments.length, page: sessionPagination.page, limit: sessionPagination.limit },
      clusters: { total: filteredClusters.length, page: clusterPagination.page, limit: clusterPagination.limit },
    },
  };
}

export async function deleteClusteringRun(runId: string) {
  if (!ObjectId.isValid(runId)) return false;
  const result = await getCollection("clustering_runs").deleteOne({ _id: new ObjectId(runId) });
  return result.deletedCount > 0;
}
