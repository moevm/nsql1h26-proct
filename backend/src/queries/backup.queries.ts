import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import { entityNames, type EntityName } from "../schema/entity.schema.js";

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

export async function exportCollections() {
  const data: Record<string, Document[]> = {};
  for (const name of entityNames) {
    data[name] = await getCollection(name).find({}).toArray();
  }
  return data;
}

export async function importCollections(payload: Partial<Record<EntityName, Document[]>>) {
  for (const name of Object.keys(payload) as EntityName[]) {
    if (!entityNames.includes(name) || !Array.isArray(payload[name])) continue;
    await getCollection(name).deleteMany({});
    const documents = payload[name]!.map((item) => reviveBackupValue("", item) as Document);
    if (documents.length) await getCollection(name).insertMany(documents);
  }
}
