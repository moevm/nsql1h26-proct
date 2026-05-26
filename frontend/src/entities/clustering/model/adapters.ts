import type { AnyRecord } from "../../types";
import { formatDate, formatDateOnly, formatDuration } from "../../../shared/lib/format";
import { getNested } from "../../../shared/lib/object";
import type { ClusterRunHistoryRow, DrawerMetric, ResultSessionRow } from "./types";

export function mapRunToHistoryRow(row: AnyRecord): ClusterRunHistoryRow {
  const status = String(row.status ?? "done");
  const algorithm = String(row.algorithm ?? "kmeans") === "dbscan" ? "DBSCAN" : "K-Means";
  const results = (row.results ?? {}) as AnyRecord;
  const filters = (row.filters ?? row.filter ?? {}) as AnyRecord;
  const startedAtRaw = String(row.startedAt ?? "");
  const finishedAtRaw = String(row.finishedAt ?? "");
  const startedAtTime = new Date(startedAtRaw).getTime();
  const finishedAtTime = new Date(finishedAtRaw).getTime();
  const durationSeconds = Number.isNaN(startedAtTime) || Number.isNaN(finishedAtTime)
    ? 0
    : Math.max(0, Math.round((finishedAtTime - startedAtTime) / 1000));
  return {
    id: String(row._id ?? ""),
    startedAtRaw,
    startedAt: formatDate(startedAtRaw),
    finishedAtRaw,
    finishedAt: formatDate(finishedAtRaw),
    durationSeconds,
    duration: formatDuration(startedAtRaw, finishedAtRaw),
    algorithm,
    clusters: Number(results.clusterCount ?? 0),
    anomalies: Number(results.anomalyCount ?? 0),
    status: status === "running" ? "running" : status === "error" ? "error" : "success",
    subset: String(filters.label ?? filters.examName ?? "Все доступные сессии"),
  };
}

export function mapResultToSessionRows(result: AnyRecord | undefined): ResultSessionRow[] {
  const nestedResults = (result?.results ?? {}) as AnyRecord;
  const rows = (result?.sessions ?? result?.items ?? nestedResults.sessions ?? []) as AnyRecord[];
  return rows.map((row, index) => {
    const metrics = (row.metrics ?? {}) as Record<string, unknown>;
    const student = (row.student ?? {}) as AnyRecord;
    const clusterIndex = Number(row.cluster ?? row.clusterId);
    return {
      id: String(row._id ?? row.sessionId ?? row.id ?? index),
      student: String(row.studentName ?? student.fullName ?? row.studentId ?? "—"),
      date: formatDateOnly(row.startTime ?? row.date ?? row.createdAt),
      cluster: String(row.clusterLabel ?? (Number.isFinite(clusterIndex) ? (clusterIndex < 0 ? "noise" : `C${clusterIndex + 1}`) : row.cluster ?? "—")),
      anomaly: Boolean(row.isAnomaly ?? row.anomaly),
      confidence: Number.isFinite(Number(row.confidence ?? row.assignmentConfidence ?? row.score)) ? Number(row.confidence ?? row.assignmentConfidence ?? row.score) : undefined,
      distanceToCentroid: Number.isFinite(Number(row.distanceToCentroid)) ? Number(row.distanceToCentroid) : undefined,
      metrics,
    };
  });
}

function metricValue(metrics: Record<string, unknown> | undefined, paths: string[], fallback = 0) {
  for (const path of paths) {
    const value = getNested(metrics as AnyRecord | undefined, path);
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

export function mapSessionToDrawerMetrics(session: ResultSessionRow) {
  const metrics = session.metrics;
  const actionCount = metricValue(metrics, ["moodle.actionCount", "moodleActions", "actionCount"]);
  const actionsPerMinute = metricValue(metrics, ["moodle.actionsPerMinute", "actionsPerMinute"]);
  const passiveRatio = metricValue(metrics, ["moodle.passiveActiveRatio", "passiveActiveRatio"]);
  const pageTransitions = metricValue(metrics, ["moodle.pageTransitions", "pageTransitions"]);
  const faceMissing = metricValue(metrics, ["ocr.faceMissingSeconds", "camera.faceMissingSeconds", "faceMissingSeconds"]);
  const extraFace = metricValue(metrics, ["ocr.extraFaceSeconds", "camera.extraFaceSeconds", "extraFaceSeconds"]);
  const faceChanges = metricValue(metrics, ["ocr.faceChanges", "camera.faceChanges", "faceChanges"]);
  const matchConfidence = metricValue(metrics, ["ocr.faceMatchConfidence", "camera.faceMatchConfidence", "faceMatchConfidence"]);

  const moodleMetrics: DrawerMetric[] = [
    { label: "Всего действий", value: actionCount.toFixed(0) },
    { label: "Действий в минуту", value: actionsPerMinute.toFixed(2) },
    { label: "Соотношение пас./акт.", value: passiveRatio.toFixed(2) },
    { label: "Переходов по страницам", value: pageTransitions.toFixed(0) },
  ];

  const cameraMetrics: DrawerMetric[] = [
    { label: "Длит. отсутствия лица", value: `${Math.round(faceMissing / 60)}м ${Math.round(faceMissing % 60)}с` },
    { label: "Длит. постороннего лица", value: `${Math.round(extraFace / 60)}м ${Math.round(extraFace % 60)}с` },
    { label: "Количество смен лица", value: faceChanges.toFixed(0) },
    { label: "Ср. уверенность совпадения", value: Number.isFinite(matchConfidence) ? matchConfidence.toFixed(2) : "—" },
  ];

  return { moodleMetrics, cameraMetrics };
}
