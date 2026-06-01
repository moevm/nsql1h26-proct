import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { UnresolvedStudent } from "../schema/upload.schema.js";

export function deriveUploadFileCount(upload: Document) {
  const files = (upload.files ?? {}) as Record<string, unknown>;
  const keys = Object.keys(files);
  return keys.length || Number(upload.filesCount ?? 1) || 1;
}

export function deriveBatchUploadMetrics(uploads: Document[]) {
  return {
    filesCount: uploads.reduce((sum, upload) => sum + deriveUploadFileCount(upload), 0),
    totalRows: uploads.reduce((sum, item) => sum + Number(item.totalRows ?? 0), 0),
    matchedStudents: uploads.reduce((sum, item) => sum + Number(item.matchedStudents ?? 0), 0),
  };
}

export function withDerivedUploadFields(upload: Document) {
  return {
    ...upload,
    filesCount: deriveUploadFileCount(upload),
  };
}

export function mergeUnresolvedStudents(existing: UnresolvedStudent[], incoming: UnresolvedStudent[]) {
  const merged = new Map(existing.map((item) => [item.externalId, item]));
  for (const item of incoming) {
    if (item.externalId) merged.set(item.externalId, item);
  }
  return [...merged.values()];
}

type StatusChangeParams = {
  uploadId: ObjectId;
  oldStatus: string;
  newStatus: string;
  userId: ObjectId;
  reason: string;
  details?: Document;
};

export async function recordUploadStatusChange({ uploadId, oldStatus, newStatus, userId, reason, details }: StatusChangeParams) {
  if (oldStatus === newStatus) return;

  const now = new Date();
  const historyEntry = {
    oldStatus,
    newStatus,
    changedAt: now,
    changedBy: String(userId),
    reason,
  };

  await getCollection("audit_logs").insertOne({
    actorUserId: userId,
    actorType: "user",
    action: "upload.status_change",
    entityType: "upload",
    entityId: uploadId,
    occurredAt: now,
    details: { oldStatus, newStatus, reason, ...(details ?? {}) },
  });

  return historyEntry;
}

export async function transitionUploadsInScope(
  filter: Document,
  newStatus: string,
  userId: ObjectId,
  reason: string,
  extraSet: Document = {},
  extraPush: Document = {},
) {
  const uploads = await getCollection("uploads").find(filter).toArray();
  for (const upload of uploads) {
    const uploadId = upload._id as ObjectId;
    const oldStatus = String(upload.status ?? "");
    const historyEntry = await recordUploadStatusChange({
      uploadId,
      oldStatus,
      newStatus,
      userId,
      reason,
    });

    const now = new Date();
    const setPayload: Document = { status: newStatus, updateTime: now, processingFinishedAt: now, ...extraSet };
    const pushPayload: Document = { ...extraPush };
    if (historyEntry) pushPayload.statusHistory = historyEntry;

    const mongoUpdate: Document = { $set: setPayload };
    if (Object.keys(pushPayload).length) mongoUpdate.$push = pushPayload;

    await getCollection("uploads").updateOne({ _id: uploadId }, mongoUpdate);
  }
  return uploads.length;
}
