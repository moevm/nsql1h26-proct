import { Router } from "express";
import type { Document } from "mongodb";
import express from "express";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { exportBackup, importBackup } from "../services/backup.service.js";
import multer from "multer";

export const backupRouter = Router();

backupRouter.get(
  "/backup/export",
  auth,
  asyncHandler(async (_req, res) => {
    res.json(await exportBackup());
  }),
);

const upload = multer({ limits: { fileSize: 200 * 1024 * 1024 } });
backupRouter.post(
  "/backup/import",
  auth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const payload = JSON.parse(req.file!.buffer.toString("utf8"));
    res.json(await importBackup(payload));
  }),
);
