import { ObjectId } from "mongodb";

import {
  assertValidBackupPayload,
  buildBackupFileName,
  createBackupEnvelope,
  getPayloadSizeBytes,
  importBackupEnvelope,
  insertBackupHistory,
  listBackupHistory,
  recordBackupAudit,
  validateBackupPayload,
  type BackupEnvelope,
} from "../queries/backup.queries.js";
import type { AuthUser } from "../schema/user.schema.js";

export class BackupError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

function actorName(actor: AuthUser) {
  return actor.fullName || actor.email || actor._id;
}

export async function exportBackup(actor: AuthUser) {
  const now = new Date();
  const envelope = await createBackupEnvelope(actor, now);
  const fileName = buildBackupFileName(now);
  const sizeBytes = getPayloadSizeBytes(envelope);

  await insertBackupHistory({
    operation: "export",
    status: "success",
    fileName,
    sizeBytes,
    collectionCounts: envelope.meta.counts,
    backupVersion: String(envelope.meta.version),
    actorUserId: new ObjectId(actor._id),
    actorName: actorName(actor),
  });
  await recordBackupAudit(actor, "export", "success", { fileName, sizeBytes, collectionCounts: envelope.meta.counts });

  return { fileName, envelope };
}

export async function validateBackup(payload: unknown, actor: AuthUser, options: { fileName?: string } = {}) {
  const fileName = options.fileName || "backup.json";
  const validation = validateBackupPayload(payload);
  const status = validation.valid ? "success" : "failed";
  const sizeBytes = getPayloadSizeBytes(payload);

  await insertBackupHistory({
    operation: "validate",
    status,
    fileName,
    sizeBytes,
    collectionCounts: validation.counts,
    backupVersion: validation.version ? String(validation.version) : undefined,
    actorUserId: new ObjectId(actor._id),
    actorName: actorName(actor),
    errorMessage: validation.valid ? undefined : validation.errors.join("; "),
  });
  await recordBackupAudit(actor, "validate", status, { fileName, sizeBytes, errors: validation.errors, warnings: validation.warnings });

  return validation;
}

export async function getBackupHistory(limit?: number) {
  return listBackupHistory(limit);
}

export async function importBackup(payload: unknown, actor: AuthUser, options: { fileName?: string; confirmOverwrite?: boolean } = {}) {
  const fileName = options.fileName || "backup.json";
  const validation = validateBackupPayload(payload);
  const sizeBytes = getPayloadSizeBytes(payload);
  const baseHistory = {
    operation: "import" as const,
    fileName,
    sizeBytes,
    collectionCounts: validation.counts,
    backupVersion: validation.version ? String(validation.version) : undefined,
    actorUserId: new ObjectId(actor._id),
    actorName: actorName(actor),
  };

  if (!options.confirmOverwrite) {
    await insertBackupHistory({
      ...baseHistory,
      status: "failed",
      errorMessage: "Не подтверждена перезапись текущих данных",
    });
    await recordBackupAudit(actor, "import", "failed", { fileName, reason: "missing_confirm_overwrite" });
    throw new BackupError("Для восстановления требуется подтверждение перезаписи данных", 409);
  }

  if (!validation.valid) {
    const message = validation.errors.join("; ");
    await insertBackupHistory({ ...baseHistory, status: "failed", errorMessage: message });
    await recordBackupAudit(actor, "import", "failed", { fileName, errors: validation.errors });
    throw new BackupError(message, 400);
  }

  assertValidBackupPayload(payload);
  const collectionCounts = await importBackupEnvelope(payload as BackupEnvelope);

  await insertBackupHistory({
    ...baseHistory,
    status: "success",
    collectionCounts,
  });
  await recordBackupAudit(actor, "import", "success", { fileName, sizeBytes, collectionCounts });

  return { ok: true, collectionCounts, warnings: validation.warnings };
}
