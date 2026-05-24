import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { AuthUser } from "../schema/user.schema.js";

export async function getUploadLog(uploadId: string, filters: { level?: string; lineFrom?: number; lineTo?: number }) {
  if (!ObjectId.isValid(uploadId)) return null;

  const objectId = new ObjectId(uploadId);
  const directUpload = await getCollection("uploads").findOne({ _id: objectId });
  const uploads = directUpload ? [directUpload] : await getCollection("uploads").find({ importBatchId: objectId }).sort({ createdAt: 1 }).toArray();
  if (!uploads.length) return null;

  const lineFrom = filters.lineFrom ?? Number.NEGATIVE_INFINITY;
  const lineTo = filters.lineTo ?? Number.POSITIVE_INFINITY;
  const processingLog = uploads.flatMap((upload) =>
    ((upload.processingLog as Document[]) ?? [])
      .map((entry): Document => ({ ...entry, sourceFileKey: entry.sourceFileKey ?? Object.keys((upload.files as Document) ?? {})[0] ?? "csv" }))
      .filter((entry) => {
        const line = Number(entry.line ?? 0);
        return (!filters.level || entry.level === filters.level) && line >= lineFrom && line <= lineTo;
      }),
  );

  const upload =
    directUpload ??
    ({
      _id: objectId,
      importBatchId: objectId,
      createdAt: uploads[0]?.createdAt,
      updateTime: uploads.at(-1)?.updateTime,
      status: uploads.some((item) => String(item.status).includes("warning")) ? "done_with_warnings" : uploads.some((item) => String(item.status) === "failed") ? "failed" : "done",
      filesCount: uploads.reduce((sum, item) => sum + Number(item.filesCount ?? 1), 0),
      totalRows: uploads.reduce((sum, item) => sum + Number(item.totalRows ?? 0), 0),
      matchedStudents: uploads.reduce((sum, item) => sum + Number(item.matchedStudents ?? 0), 0),
      files: Object.assign({}, ...uploads.map((item) => item.files ?? {})),
    } as Document);

  return { upload, processingLog, unresolvedStudents: uploads.flatMap((upload) => (upload.unresolvedStudents as Document[]) ?? []) };
}

export async function createDemoUpload(user: AuthUser) {
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
  });
  await getCollection("audit_logs").insertOne({
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

export async function markUploadProcessed(uploadId: string) {
  const now = new Date();
  await getCollection("uploads").updateOne(
    { _id: new ObjectId(uploadId) },
    {
      $set: { status: "done", updateTime: now, totalRows: 120, matchedStudents: 3 },
      $push: {
        processingLog: {
          timestamp: now,
          level: "info",
          sourceFileKey: "demo",
          line: 1,
          entityType: "session",
          message: "Демо-обработка завершена",
        },
      } as Document,
    } as Document,
  );
}
