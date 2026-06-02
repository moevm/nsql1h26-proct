import { getBackupHistoryCollection, getCollection } from "./collections.js";

export async function ensureIndexes() {
  await getCollection("users").createIndex({ email: 1 }, { unique: true });
  await getCollection("uploads").createIndex({ status: 1, createdAt: -1 });
  await getCollection("uploads").createIndex({ importBatchId: 1, createdAt: -1 });
  await getCollection("uploads").createIndex({ importBatchId: 1, status: 1 });
  await getCollection("uploads").createIndex({ importBatchId: 1, "files.students.sha256": 1 });
  await getCollection("uploads").createIndex({ importBatchId: 1, "files.sessions.sha256": 1 });
  await getCollection("uploads").createIndex({ importBatchId: 1, "files.moodle_events.sha256": 1 });
  await getCollection("uploads").createIndex({ importBatchId: 1, "files.ocr_events.sha256": 1 });
  await getCollection("students").createIndex({ fullName: "text", email: "text", group: 1 });
  await getCollection("students").createIndex({ importBatchId: 1, group: 1, program: 1, educationLevel: 1 });
  await getCollection("timeline_events").createIndex({ sessionId: 1, eventTime: 1 });
  await getCollection("sessions").createIndex({ uploadId: 1, startTime: -1 });
  await getCollection("sessions").createIndex({ importBatchId: 1, startTime: -1, examName: 1 });
  await getCollection("clustering_runs").createIndex({ status: 1, algorithm: 1, startedAt: -1 });
  await getBackupHistoryCollection().createIndex({ createdAt: -1 });
  await getBackupHistoryCollection().createIndex({ payloadFileId: 1 });
  await getCollection("audit_logs").createIndex({ occurredAt: -1 });
  await getCollection("audit_logs").createIndex({ actorUserId: 1, occurredAt: -1 });
  await getCollection("audit_logs").createIndex({ entityType: 1, entityId: 1, occurredAt: -1 });
  await getCollection("audit_logs").createIndex({ action: 1, occurredAt: -1 });
}
