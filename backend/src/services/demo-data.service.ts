import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import { entityNames, type EntityName } from "../schema/entity.schema.js";

type DemoDump = Partial<Record<EntityName, Document[]>>;

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

function fixturePath() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(currentDir, "../fixtures/demo-data.json"),
    resolve(process.cwd(), "src/fixtures/demo-data.json"),
  ];

  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error("Demo fixture not found");
  return path;
}

function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && ObjectId.isValid(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function reviveValue(key: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (objectIdArrayKeys.has(key) && isObjectIdString(item) ? new ObjectId(item) : reviveValue(key, item)));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, reviveValue(nestedKey, nestedValue)]));
  }

  if (dateKeys.has(key) && isDateString(value)) return new Date(value);
  if (objectIdKeys.has(key) && isObjectIdString(value)) return new ObjectId(value);
  return value;
}

function loadFixture() {
  const raw = readFileSync(fixturePath(), "utf8");
  return JSON.parse(raw) as DemoDump;
}

async function normalizeUsers(users: Document[]) {
  const normalized = [];

  for (const user of users) {
    const next = { ...user };
    const password = typeof next.password === "string" ? next.password.trim() : "";
    delete next.password;

    if (password && !next.passwordHash) {
      next.passwordHash = await bcrypt.hash(password, 10);
    }

    normalized.push(next);
  }

  return normalized;
}

export async function seedDemoData(options: { reset?: boolean } = {}) {
  const dump = loadFixture();
  const result: Record<string, number> = {};

  if (options.reset) {
    for (const entity of [...entityNames].reverse()) {
      await getCollection(entity).deleteMany({});
    }
  }

  for (const entity of entityNames) {
    const items = (dump[entity] ?? []).map((item) => reviveValue("", item) as Document);
    const normalized = entity === "users" ? await normalizeUsers(items) : items;
    if (normalized.length) await getCollection(entity).insertMany(normalized, { ordered: false });
    result[entity] = normalized.length;
  }

  return result;
}

export const seedLargeDemoData = seedDemoData;
