import { Router } from "express";
import type { Document } from "mongodb";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { EntityName } from "../schema/entity.schema.js";
import { exportBackup, importBackup } from "../services/backup.service.js";

export const backupRouter = Router();

backupRouter.get(
  "/backup/export",
  auth,
  asyncHandler(async (_req, res) => {
    res.json(await exportBackup());
  }),
);

backupRouter.post(
  "/backup/import",
  auth,
  asyncHandler(async (req, res) => {
    res.json(await importBackup(req.body as Partial<Record<EntityName, Document[]>>));
  }),
);
