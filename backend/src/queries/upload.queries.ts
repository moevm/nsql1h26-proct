import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { AuthUser } from "../schema/user.schema.js";
import type { UnresolvedStudent } from "../schema/upload.schema.js";
import { safeRecordAuditEvent, type AuditContext } from "../services/audit.service.js";
import { deriveBatchUploadMetrics, mergeUnresolvedStudents, transitionUploadsInScope } from "../services/upload-lifecycle.service.js";

const processableDemoStatuses = ["pending", "processing"];

function computeProcessingDurationMs(uploads: Document[]) {
  if (!uploads.length) return undefined;

  const startedAt = uploads.reduce((earliest, upload) => {
    const candidate = upload.processingStartedAt ?? upload.createdAt;
    const time = candidate ? new Date(String(candidate)).getTime() : Number.POSITIVE_INFINITY;
    return time < earliest ? time : earliest;
  }, Number.POSITIVE_INFINITY);

  const finishedAt = uploads.reduce((latest, upload) => {
    const candidate = upload.processingFinishedAt ?? upload.updateTime;
    const time = candidate ? new Date(String(candidate)).getTime() : 0;
    return time > latest ? time : latest;
  }, 0);

  if (!Number.isFinite(startedAt) || !finishedAt) return undefined;
  const duration = finishedAt - startedAt;
  return duration > 0 ? duration : undefined;
}

function parseTimeBound(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? fallback : parsed;
}

export async function getUploadLog(
  uploadId: string,
  filters: { level?: string; lineFrom?: number; lineTo?: number; timeFrom?: string; timeTo?: string },
) {
  if (!ObjectId.isValid(uploadId)) return null;

  const objectId = new ObjectId(uploadId);
  const directUpload = await getCollection("uploads").findOne({ _id: objectId });
  const uploads = directUpload?.importBatchId
    ? await getCollection("uploads").find({ importBatchId: directUpload.importBatchId }).sort({ createdAt: 1 }).toArray()
    : directUpload
      ? [directUpload]
      : await getCollection("uploads").find({ importBatchId: objectId }).sort({ createdAt: 1 }).toArray();
  if (!uploads.length) return null;

  const lineFrom = filters.lineFrom ?? Number.NEGATIVE_INFINITY;
  const lineTo = filters.lineTo ?? Number.POSITIVE_INFINITY;
  const timeFrom = parseTimeBound(filters.timeFrom, Number.NEGATIVE_INFINITY);
  const timeTo = parseTimeBound(filters.timeTo, Number.POSITIVE_INFINITY);

  const processingLog = uploads.flatMap((upload) =>
    ((upload.processingLog as Document[]) ?? [])
      .map((entry): Document => ({ ...entry, sourceFileKey: entry.sourceFileKey ?? Object.keys((upload.files as Document) ?? {})[0] ?? "csv" }))
      .filter((entry) => {
        const line = Number(entry.line ?? 0);
        const timestamp = entry.timestamp ? new Date(String(entry.timestamp)).getTime() : 0;
        const matchesTime = timestamp >= timeFrom && timestamp <= timeTo;
        return (!filters.level || entry.level === filters.level) && line >= lineFrom && line <= lineTo && matchesTime;
      }),
  );

  const firstUpload = uploads[0];
  const userId = firstUpload?.userId as ObjectId | undefined;
  let createdByName: string | undefined;
  if (userId) {
    const user = await getCollection("users").findOne({ _id: userId }, { projection: { fullName: 1, email: 1 } });
    createdByName = String(user?.fullName ?? user?.email ?? "");
  }

  const batchMetrics = deriveBatchUploadMetrics(uploads);

  const upload: Document =
    directUpload ??
    ({
      _id: objectId,
      importBatchId: objectId,
      createdAt: uploads[0]?.createdAt,
      updateTime: uploads.at(-1)?.updateTime,
      status: uploads.some((item) => String(item.status).includes("warning")) ? "done_with_warnings" : uploads.some((item) => String(item.status) === "failed") ? "failed" : "done",
      filesCount: batchMetrics.filesCount,
      totalRows: batchMetrics.totalRows,
      matchedStudents: batchMetrics.matchedStudents,
      files: Object.assign({}, ...uploads.map((item) => item.files ?? {})),
      processingState: uploads[0]?.processingState,
      processingStartedAt: uploads[0]?.processingStartedAt ?? uploads[0]?.createdAt,
      processingFinishedAt: uploads.at(-1)?.processingFinishedAt ?? uploads.at(-1)?.updateTime,
    } as Document);

  const processingDurationMs = computeProcessingDurationMs(uploads);
  if (processingDurationMs !== undefined) {
    upload.processingDurationMs = processingDurationMs;
  }
  if (createdByName) {
    upload.createdByName = createdByName;
  }

  return {
    upload,
    processingLog,
    unresolvedStudents: mergeUnresolvedStudents(
      [],
      uploads.flatMap((upload) => (upload.unresolvedStudents as UnresolvedStudent[] | undefined) ?? []),
    ),
  };
}

export async function createDemoUpload(user: AuthUser, auditContext?: AuditContext) {
  const now = new Date();
  const uploadId = new ObjectId();
  await getCollection("uploads").insertOne({
    _id: uploadId,
    userId: new ObjectId(user._id),
    createdAt: now,
    updateTime: now,
    status: "pending",
    filesCount: 3,
    totalRows: 0,
    matchedStudents: 0,
    processingLog: [{ timestamp: now, level: "info", sourceFileKey: "demo", line: 1, entityType: "upload", message: "Демо-загрузка создана" }],
    unresolvedStudents: [],
    processingStartedAt: now,
  });
  await safeRecordAuditEvent({
    ...auditContext,
    actorUserId: new ObjectId(user._id),
    actorType: "user",
    action: "upload.create",
    entityType: "upload",
    entityId: uploadId,
    occurredAt: now,
    details: { source: "demo" },
  });
  return uploadId;
}

export async function markUploadProcessed(uploadId: string, user: AuthUser, auditContext?: AuditContext) {
  if (!ObjectId.isValid(uploadId)) return 0;

  const objectId = new ObjectId(uploadId);
  const directUpload = await getCollection("uploads").findOne({ _id: objectId });
  const filter = directUpload
    ? { _id: objectId, status: { $in: processableDemoStatuses }, files: { $exists: false } }
    : { importBatchId: objectId, status: { $in: processableDemoStatuses }, files: { $exists: false } };

  return transitionUploadsInScope(
    filter,
    "done",
    new ObjectId(user._id),
    "Обработка завершена",
    { processingFinishedAt: new Date(), totalRows: 120, matchedStudents: 3 },
    {
      processingLog: {
        timestamp: new Date(),
        level: "info",
        sourceFileKey: "processing",
        line: 1,
        entityType: "session",
        message: "Обработка завершена",
      },
    },
    auditContext,
  );
}
