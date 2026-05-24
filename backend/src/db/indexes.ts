import { getCollection } from "./collections.js";

export async function ensureIndexes() {
  await getCollection("users").createIndex({ email: 1 }, { unique: true });
  await getCollection("uploads").createIndex({ status: 1, createdAt: -1 });
  await getCollection("uploads").createIndex({ importBatchId: 1, createdAt: -1 });
  await getCollection("students").createIndex({ fullName: "text", email: "text", group: 1 });
  await getCollection("students").createIndex({ importBatchId: 1, group: 1, program: 1, educationLevel: 1 });
  await getCollection("timeline_events").createIndex({ sessionId: 1, eventTime: 1 });
  await getCollection("sessions").createIndex({ uploadId: 1, startTime: -1 });
  await getCollection("sessions").createIndex({ importBatchId: 1, startTime: -1, examName: 1 });
  await getCollection("clustering_runs").createIndex({ status: 1, algorithm: 1, startedAt: -1 });
}
