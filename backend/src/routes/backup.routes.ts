import { Router } from "express";
import multer from "multer";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { AuthUser } from "../schema/user.schema.js";
import { recordRequestAuditEvent } from "../services/audit.service.js";
import { exportBackup, importBackup } from "../services/backup.service.js";

export const backupRouter = Router();

backupRouter.get(
  "/backup/export",
  auth,
  asyncHandler(async (req, res) => {
    const backup = await exportBackup();
    await recordRequestAuditEvent(req, res.locals.user as AuthUser, {
      action: "backup.export",
      entityType: "backup",
      details: {
        collections: Object.fromEntries(Object.entries(backup).map(([name, items]) => [name, items.length])),
      },
    });
    res.json(backup);
  }),
);

const upload = multer({ limits: { fileSize: 200 * 1024 * 1024 } });
backupRouter.post(
  "/backup/import",
  auth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const payload = JSON.parse(req.file!.buffer.toString("utf8"));
    const result = await importBackup(payload);
    await recordRequestAuditEvent(req, res.locals.user as AuthUser, {
      action: "backup.import",
      entityType: "backup",
      details: {
        collections: Object.fromEntries(
          Object.entries(payload as Record<string, unknown>).map(([name, items]) => [name, Array.isArray(items) ? items.length : 0]),
        ),
      },
    });
    res.json(result);
  }),
);
