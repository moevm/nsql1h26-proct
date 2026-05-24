import { Router } from "express";
import multer from "multer";
import { ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { getUploadLog } from "../queries/upload.queries.js";
import type { AuthUser } from "../schema/user.schema.js";
import { getCsvTemplate, getCsvTemplateFileName, importCsv, isCsvImportKind } from "../services/csv-import.service.js";
import { createDemoImport, processUpload } from "../services/import.service.js";
import { getQuery, serializeDocument } from "../utils/query.js";

export const uploadsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

uploadsRouter.get(
  "/uploads/:id/log",
  auth,
  asyncHandler(async (req, res) => {
    const data = await getUploadLog(String(req.params.id), {
      level: getQuery(req.query, "level"),
      lineFrom: Number(getQuery(req.query, "lineFrom") ?? Number.NEGATIVE_INFINITY),
      lineTo: Number(getQuery(req.query, "lineTo") ?? Number.POSITIVE_INFINITY),
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
  asyncHandler(async (_req, res) => {
    const uploadId = await createDemoImport(res.locals.user as AuthUser);
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

    await Promise.all([
      getCollection("uploads").deleteMany({ _id: { $in: uploadIds } }),
      getCollection("students").deleteMany(linkedFilter),
      getCollection("sessions").deleteMany(linkedFilter),
      getCollection("timeline_events").deleteMany(linkedFilter),
      getCollection("clustering_runs").deleteMany({ $or: [{ uploadIds: { $in: uploadIds } }, { "filter.batchIds": { $in: batchIds.map(String) } }] }),
    ]);

    res.status(204).send();
  }),
);

uploadsRouter.post(
  "/process/:uploadId",
  auth,
  asyncHandler(async (req, res) => {
    const result = await processUpload(String(req.params.uploadId));
    res.json(result);
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

    const result = await importCsv(kind, req.file.buffer, res.locals.user as AuthUser, {
      batchId: typeof req.body.batchId === "string" ? req.body.batchId : undefined,
      originalName: req.file.originalname,
    });
    res.status(201).json(result);
  }),
);
