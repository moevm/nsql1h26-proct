import { Router } from "express";
import multer from "multer";
import { ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { getUploadLog } from "../queries/upload.queries.js";
import type { AuthUser } from "../schema/user.schema.js";
import { getAuditContext, recordRequestAuditEvent } from "../services/audit.service.js";
import { getCsvTemplate, getCsvTemplateFileName, importCsv, isCsvImportKind } from "../services/csv-import.service.js";
import { createDemoImport, getUploadProcessingStatus, processUpload, retryUploadProcessing, stopUploadProcessing } from "../services/import.service.js";
import { removeUploadStorageDir } from "../services/upload-storage.service.js";
import { getQuery, serializeDocument } from "../utils/query.js";

export const uploadsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function getValidDateQuery(value: string | undefined) {
  if (!value) return undefined;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

uploadsRouter.get(
  "/uploads/:id/log",
  auth,
  asyncHandler(async (req, res) => {
    const timeFrom = getValidDateQuery(getQuery(req.query, "timeFrom"));
    const timeTo = getValidDateQuery(getQuery(req.query, "timeTo"));
    if (timeFrom === null || timeTo === null) {
      res.status(400).json({ message: "Некорректный фильтр времени" });
      return;
    }

    const data = await getUploadLog(String(req.params.id), {
      level: getQuery(req.query, "level"),
      lineFrom: Number(getQuery(req.query, "lineFrom") ?? Number.NEGATIVE_INFINITY),
      lineTo: Number(getQuery(req.query, "lineTo") ?? Number.POSITIVE_INFINITY),
      timeFrom,
      timeTo,
    });

    if (!data) {
      res.status(404).json({ message: "Загрузка не найдена" });
      return;
    }

    res.json({
      upload: serializeDocument(data.upload),
      processingLog: data.processingLog,
      unresolvedStudents: data.unresolvedStudents,
    });
  }),
);

uploadsRouter.post(
  "/import-demo",
  auth,
  asyncHandler(async (req, res) => {
    const user = res.locals.user as AuthUser;
    const uploadId = await createDemoImport(user, getAuditContext(req, user));
    res.status(201).json({ _id: uploadId });
  }),
);

uploadsRouter.delete(
  "/uploads/:id",
  auth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ message: "Некорректный ID загрузки" });
      return;
    }

    const objectId = new ObjectId(id);
    const uploads = await getCollection("uploads")
      .find({ $or: [{ _id: objectId }, { importBatchId: objectId }] })
      .toArray();

    if (!uploads.length) {
      res.status(404).json({ message: "Загрузка не найдена" });
      return;
    }

    const uploadIds = uploads.map((item) => item._id as ObjectId);
    const batchIds = [...new Set(uploads.map((item) => String(item.importBatchId ?? item._id)).filter(Boolean))].map((value) => new ObjectId(value));
    const linkedFilter = { $or: [{ uploadId: { $in: uploadIds } }, { importBatchId: { $in: batchIds } }] };

    const [uploadDelete, studentDelete, sessionDelete, eventDelete, clusteringDelete] = await Promise.all([
      getCollection("uploads").deleteMany({ _id: { $in: uploadIds } }),
      getCollection("students").deleteMany(linkedFilter),
      getCollection("sessions").deleteMany(linkedFilter),
      getCollection("timeline_events").deleteMany(linkedFilter),
      getCollection("clustering_runs").deleteMany({ $or: [{ uploadIds: { $in: uploadIds } }, { "filter.batchIds": { $in: batchIds.map(String) } }] }),
    ]);
    await Promise.all(uploadIds.map((uploadId) => removeUploadStorageDir(uploadId)));

    await recordRequestAuditEvent(req, res.locals.user as AuthUser, {
      action: "upload.delete",
      entityType: "upload",
      entityId: objectId,
      details: {
        uploadIds: uploadIds.map(String),
        batchIds: batchIds.map(String),
        deletedCounts: {
          uploads: uploadDelete.deletedCount,
          students: studentDelete.deletedCount,
          sessions: sessionDelete.deletedCount,
          timelineEvents: eventDelete.deletedCount,
          clusteringRuns: clusteringDelete.deletedCount,
        },
      },
    });

    res.status(204).send();
  }),
);

uploadsRouter.post(
  "/process/:uploadId",
  auth,
  asyncHandler(async (req, res) => {
    const user = res.locals.user as AuthUser;
    const result = await processUpload(String(req.params.uploadId), user, getAuditContext(req, user));
    res.json(serializeDocument(result));
  }),
);

uploadsRouter.get(
  "/process/:uploadId",
  auth,
  asyncHandler(async (req, res) => {
    const result = await getUploadProcessingStatus(String(req.params.uploadId), res.locals.user as AuthUser);
    res.json(serializeDocument(result));
  }),
);

uploadsRouter.post(
  "/process/:uploadId/stop",
  auth,
  asyncHandler(async (req, res) => {
    const result = await stopUploadProcessing(String(req.params.uploadId), res.locals.user as AuthUser);
    res.json(serializeDocument(result));
  }),
);

uploadsRouter.post(
  "/process/:uploadId/retry",
  auth,
  asyncHandler(async (req, res) => {
    const user = res.locals.user as AuthUser;
    const result = await retryUploadProcessing(String(req.params.uploadId), user, getAuditContext(req, user));
    res.json(serializeDocument(result));
  }),
);

uploadsRouter.get("/import/templates/:kind.csv", auth, (req, res) => {
  const kind = String(req.params.kind);
  if (!isCsvImportKind(kind)) {
    res.status(404).json({ message: "Неизвестный шаблон CSV" });
    return;
  }

  res.header("Content-Type", "text/csv; charset=utf-8");
  res.attachment(getCsvTemplateFileName(kind));
  res.send(getCsvTemplate(kind));
});

uploadsRouter.post(
  "/import/csv/:kind",
  auth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const kind = String(req.params.kind);
    if (!isCsvImportKind(kind)) {
      res.status(404).json({ message: "Неизвестный тип CSV импорта" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "CSV файл обязателен в поле file" });
      return;
    }

    const user = res.locals.user as AuthUser;
    const result = await importCsv(kind, req.file.buffer, user, {
      batchId: typeof req.body.batchId === "string" ? req.body.batchId : undefined,
      originalName: req.file.originalname,
      auditContext: getAuditContext(req, user),
    });
    res.status(201).json(result);
  }),
);
