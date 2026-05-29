import type { Document } from "mongodb";

export type EntityName =
  | "users"
  | "universities"
  | "uploads"
  | "students"
  | "timeline_events"
  | "sessions"
  | "clustering_runs"
  | "audit_logs";

export type EntityFilterConfig = {
  text: string[];
  dates: string[];
  numbers: string[];
  exact: string[];
  objectIds: string[];
  defaultSort: Document;
};

export const entityNames: EntityName[] = [
  "users",
  "universities",
  "uploads",
  "students",
  "timeline_events",
  "sessions",
  "clustering_runs",
  "audit_logs",
];

export const entityConfig: Record<EntityName, EntityFilterConfig> = {
  users: {
    text: ["email", "fullName", "role"],
    dates: ["createdAt", "updateTime"],
    numbers: [],
    exact: ["role"],
    objectIds: [],
    defaultSort: { createdAt: -1 },
  },
  universities: {
    text: ["name", "shortName", "externalCode"],
    dates: ["createdAt", "updateTime"],
    numbers: [],
    exact: [],
    objectIds: [],
    defaultSort: { name: 1 },
  },
  uploads: {
    text: ["status", "filesText"],
    dates: ["createdAt", "updateTime"],
    numbers: ["filesCount", "totalRows", "matchedStudents"],
    exact: ["status"],
    objectIds: ["userId", "importBatchId"],
    defaultSort: { createdAt: -1 },
  },
  students: {
    text: ["externalId", "recordBookNumber", "fullName", "email", "faculty", "program", "educationLevel", "group"],
    dates: ["createdAt", "updateTime"],
    numbers: [],
    exact: ["educationLevel", "group"],
    objectIds: ["uploadId", "importBatchId", "universityId"],
    defaultSort: { fullName: 1 },
  },
  timeline_events: {
    text: ["eventType", "sourceFileKey", "moodle.action", "moodle.target", "moodle.courseName", "system.code"],
    dates: ["eventTime", "createdAt", "updateTime"],
    numbers: ["ocr.frameIndex", "ocr.videoOffsetMs", "moodle.timeSpent"],
    exact: ["eventType"],
    objectIds: ["uploadId", "importBatchId", "studentId", "sessionId"],
    defaultSort: { eventTime: -1 },
  },
  sessions: {
    text: ["examName", "metrics.combined.riskLevel"],
    dates: ["startTime", "endTime", "createdAt", "updateTime"],
    numbers: [
      "durationMinutes",
      "metrics.moodle.totalActions",
      "metrics.moodle.actionsPerMinute",
      "metrics.ocr.faceAbsenceRate",
      "metrics.combined.anomalyScore",
    ],
    exact: ["metrics.combined.riskLevel"],
    objectIds: ["uploadId", "importBatchId", "studentId"],
    defaultSort: { startTime: -1 },
  },
  clustering_runs: {
    text: ["status", "algorithm", "parameters.distanceMetric"],
    dates: ["startedAt", "finishedAt", "createdAt", "updateTime", "filter.dateFrom", "filter.dateTo"],
    numbers: ["results.totalSessions", "results.clusterCount", "results.anomalyCount", "results.anomalyRate"],
    exact: ["status", "algorithm"],
    objectIds: ["userId"],
    defaultSort: { startedAt: -1 },
  },
  audit_logs: {
    text: ["actorType", "action", "entityType", "entityId", "ip", "userAgent"],
    dates: ["occurredAt"],
    numbers: [],
    exact: ["actorType", "entityType"],
    objectIds: ["_id", "actorUserId", "entityId"],
    defaultSort: { occurredAt: -1 },
  },
};
