import { Document, ObjectId } from "mongodb";

import { getBackupHistoryCollection, getCollection } from "../db/collections.js";
import { entityNames, type EntityName } from "../schema/entity.schema.js";
import type { AuthUser } from "../schema/user.schema.js";

export const BACKUP_FORMAT = "nsql-proctoring-backup";
export const BACKUP_VERSION = 1;

export type BackupOperation = "export" | "import" | "validate";
export type BackupOperationStatus = "success" | "failed";

export type BackupEnvelope = {
  meta: {
    format: typeof BACKUP_FORMAT;
    version: typeof BACKUP_VERSION;
    createdAt: string;
    createdBy: string;
    collections: EntityName[];
    counts: Record<EntityName, number>;
  };
  data: Partial<Record<EntityName, Document[]>>;
};

export type BackupValidationResult = {
  valid: boolean;
  format?: string;
  version?: number;
  counts: Partial<Record<EntityName, number>>;
  errors: string[];
  warnings: string[];
};

export type BackupHistoryRecord = {
  _id?: ObjectId;
  operation: BackupOperation;
  status: BackupOperationStatus;
  fileName: string;
  sizeBytes: number;
  collectionCounts: Partial<Record<EntityName, number>>;
  backupVersion?: string;
  appVersion?: string;
  actorUserId: ObjectId;
  actorName: string;
  createdAt: Date;
  errorMessage?: string;
};

const objectIdKeys = new Set([
  "_id",
  "actorUserId",
  "entityId",
  "importBatchId",
  "sessionId",
  "studentId",
  "universityId",
  "uploadId",
  "userId",
]);

const objectIdArrayKeys = new Set(["uploadIds"]);

const dateKeys = new Set([
  "changedAt",
  "createdAt",
  "dateFrom",
  "dateTo",
  "endTime",
  "eventTime",
  "finishedAt",
  "occurredAt",
  "startTime",
  "startedAt",
  "timestamp",
  "updateTime",
]);

function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && ObjectId.isValid(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function reviveBackupValue(key: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (objectIdArrayKeys.has(key) && isObjectIdString(item) ? new ObjectId(item) : reviveBackupValue(key, item)));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, reviveBackupValue(nestedKey, nestedValue)]));
  }

  if (dateKeys.has(key) && isDateString(value)) return new Date(value);
  if (objectIdKeys.has(key) && isObjectIdString(value)) return new ObjectId(value);
  return value;
}

function backupHistoryCollection() {
  return getBackupHistoryCollection<BackupHistoryRecord>();
}

export function buildBackupFileName(now = new Date()) {
  return `backup_proctoring_${now.toISOString().replace(/[:.]/g, "-")}.json`;
}

export function getPayloadSizeBytes(payload: unknown) {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

function actorName(actor: AuthUser) {
  return actor.fullName || actor.email || actor._id;
}

async function writeAuditLog(actor: AuthUser, action: string, details: Document) {
  await getCollection("audit_logs").insertOne({
    actorUserId: new ObjectId(actor._id),
    actorType: "user",
    action,
    entityType: "backup",
    entityId: new ObjectId(),
    occurredAt: new Date(),
    details,
  });
}

export async function exportCollections() {
  const data: Partial<Record<EntityName, Document[]>> = {};
  for (const name of entityNames) {
    data[name] = await getCollection(name).find({}).toArray();
  }
  return data;
}

function collectionCounts(data: Partial<Record<EntityName, Document[]>>) {
  return Object.fromEntries(entityNames.map((name) => [name, data[name]?.length ?? 0])) as Record<EntityName, number>;
}

export async function createBackupEnvelope(actor: AuthUser, now = new Date()): Promise<BackupEnvelope> {
  const data = await exportCollections();
  return {
    meta: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: now.toISOString(),
      createdBy: actorName(actor),
      collections: [...entityNames],
      counts: collectionCounts(data),
    },
    data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateBackupPayload(payload: unknown): BackupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const counts: Partial<Record<EntityName, number>> = {};

  if (!isRecord(payload)) {
    return { valid: false, counts, errors: ["Файл бэкапа должен содержать JSON-объект"], warnings };
  }

  const meta = isRecord(payload.meta) ? payload.meta : undefined;
  const data = isRecord(payload.data) ? payload.data : undefined;

  if (!meta) errors.push("Отсутствует meta с описанием бэкапа");
  if (!data) errors.push("Отсутствует data с коллекциями бэкапа");

  const format = typeof meta?.format === "string" ? meta.format : undefined;
  const version = typeof meta?.version === "number" ? meta.version : undefined;

  if (format !== BACKUP_FORMAT) errors.push("Неподдерживаемый формат бэкапа");
  if (version !== BACKUP_VERSION) errors.push("Неподдерживаемая версия бэкапа");
  if (!data) return { valid: false, format, version, counts, errors, warnings };

  for (const key of Object.keys(data)) {
    if (!entityNames.includes(key as EntityName)) {
      errors.push(`Неизвестная коллекция в бэкапе: ${key}`);
      continue;
    }
    const value = data[key];
    if (!Array.isArray(value)) {
      errors.push(`Коллекция ${key} должна быть массивом`);
      continue;
    }
    counts[key as EntityName] = value.length;
  }

  for (const name of entityNames) {
    if (!(name in data)) warnings.push(`Коллекция ${name} отсутствует в бэкапе и будет пропущена`);
  }

  return { valid: errors.length === 0, format, version, counts, errors, warnings };
}

export function assertValidBackupPayload(payload: unknown): asserts payload is BackupEnvelope {
  const validation = validateBackupPayload(payload);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }
}

export async function importCollections(payload: Partial<Record<EntityName, Document[]>>) {
  for (const name of Object.keys(payload) as EntityName[]) {
    if (!entityNames.includes(name) || !Array.isArray(payload[name])) continue;
    await getCollection(name).deleteMany({});
    const documents = payload[name]!.map((item) => reviveBackupValue("", item) as Document);
    if (documents.length) await getCollection(name).insertMany(documents);
  }
}

export async function importBackupEnvelope(payload: BackupEnvelope) {
  await importCollections(payload.data);
  return collectionCounts(payload.data);
}

export async function insertBackupHistory(record: Omit<BackupHistoryRecord, "_id" | "createdAt"> & { createdAt?: Date }) {
  const document: BackupHistoryRecord = { ...record, createdAt: record.createdAt ?? new Date() };
  await backupHistoryCollection().insertOne(document);
  return document;
}

export async function listBackupHistory(limit = 50) {
  return backupHistoryCollection()
    .find({})
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 200)))
    .toArray();
}

export async function recordBackupAudit(actor: AuthUser, operation: BackupOperation, status: BackupOperationStatus, details: Document) {
  await writeAuditLog(actor, `backup.${operation}.${status}`, details);
}
