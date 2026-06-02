import { gunzipSync } from "node:zlib";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { AuthUser } from "../schema/user.schema.js";
import { BackupError, exportBackup, exportBackupHistoryRecord, getBackupHistory, importBackup, validateBackup } from "../services/backup.service.js";

export const backupRouter = Router();
const upload = multer({ limits: { fileSize: 200 * 1024 * 1024 } });

export function isBackupAdmin(user: AuthUser | undefined) {
  return user?.role === "admin";
}

function adminOnly(_req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as AuthUser | undefined;
  if (!isBackupAdmin(user)) {
    res.status(403).json({ message: "Недостаточно прав" });
    return;
  }
  next();
}

function parseBackupFile(req: Request) {
  if (!req.file) throw new BackupError("Файл бэкапа обязателен в поле file", 400);
  try {
    const buffer = isGzipBackup(req.file) ? gunzipSync(req.file.buffer) : req.file.buffer;
    return JSON.parse(buffer.toString("utf8")) as unknown;
  } catch {
    throw new BackupError("Файл бэкапа должен быть корректным JSON или JSON.GZ", 400);
  }
}

function isGzipBackup(file: Express.Multer.File) {
  const name = file.originalname.toLowerCase();
  const mimeType = file.mimetype.toLowerCase();
  return name.endsWith(".gz") || mimeType.includes("gzip") || (file.buffer[0] === 0x1f && file.buffer[1] === 0x8b);
}

function sendBackupDownload(res: Response, fileName: string, buffer: Buffer, contentType = "application/gzip") {
  res.header("Content-Type", contentType);
  res.header("Content-Length", String(buffer.byteLength));
  res.attachment(fileName);
  res.send(buffer);
}

backupRouter.get(
  "/backup/export",
  auth,
  adminOnly,
  asyncHandler(async (_req, res) => {
    const { fileName, buffer, contentType } = await exportBackup(res.locals.user as AuthUser);
    sendBackupDownload(res, fileName, buffer, contentType);
  }),
);

backupRouter.get(
  "/backup/history",
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    res.json({ items: await getBackupHistory(limit) });
  }),
);

backupRouter.get(
  "/backup/history/:id/export",
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    try {
      const { fileName, buffer, contentType } = await exportBackupHistoryRecord(String(req.params.id));
      sendBackupDownload(res, fileName, buffer, contentType);
    } catch (error) {
      if (error instanceof BackupError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      throw error;
    }
  }),
);

backupRouter.post(
  "/backup/validate",
  auth,
  adminOnly,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    res.json(await validateBackup(parseBackupFile(req), res.locals.user as AuthUser, { fileName: req.file?.originalname }));
  }),
);

backupRouter.post(
  "/backup/import",
  auth,
  adminOnly,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const payload = parseBackupFile(req);
    const confirmOverwrite = req.query.confirmOverwrite === "true" || req.body?.confirmOverwrite === "true" || req.body?.confirmOverwrite === true;
    try {
      res.json(await importBackup(payload, res.locals.user as AuthUser, { fileName: req.file?.originalname, confirmOverwrite }));
    } catch (error) {
      if (error instanceof BackupError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      throw error;
    }
  }),
);
