import type { Request } from "express";
import { ObjectId, type Document } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { AuditLogDocument } from "../schema/audit-log.schema.js";
import type { AuthUser } from "../schema/user.schema.js";

export type AuditAction =
  | "auth.login_success"
  | "auth.login_failure"
  | "auth.logout"
  | "user.create"
  | "user.update"
  | "entity.create"
  | "entity.update"
  | "upload.create"
  | "upload.import_start"
  | "upload.status_change"
  | "upload.delete"
  | "clustering_run.create"
  | "clustering_run.delete"
  | "backup.export"
  | "backup.import"
  | "report.export";

export type AuditContext = {
  actorUserId?: ObjectId;
  actorType: "user" | "system";
  ip?: string;
  userAgent?: string;
};

type AuditEventInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string | ObjectId;
  actorUserId?: ObjectId | string;
  actorType?: "user" | "system";
  ip?: string;
  userAgent?: string;
  before?: Document | null;
  after?: Document | null;
  details?: Document;
  occurredAt?: Date;
};

const sensitiveKeys = new Set(["password", "passwordhash", "token", "authorization", "cookie", "set-cookie", "jwt", "secret"]);

function toObjectId(value: ObjectId | string | undefined) {
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value)) return new ObjectId(value);
  return undefined;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== "object" || value instanceof Date || value instanceof ObjectId) return value;

  return Object.fromEntries(
    Object.entries(value as Document).map(([key, nestedValue]) => [
      key,
      sensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : redactValue(nestedValue),
    ]),
  );
}

function redactAuditDocument<T extends Document | null | undefined>(value: T): T {
  return redactValue(value) as T;
}

function isDiffableObject(value: unknown): value is Document {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof ObjectId);
}

function equalAuditValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectChangedFields(before: unknown, after: unknown, path = ""): string[] {
  if (equalAuditValue(before, after)) return [];
  if (!isDiffableObject(before) || !isDiffableObject(after)) return path ? [path] : [];

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].flatMap((key) => collectChangedFields(before[key], after[key], path ? `${path}.${key}` : key));
}

export function getAuditContext(req: Request, user?: AuthUser): AuditContext {
  return {
    actorUserId: toObjectId(user?._id),
    actorType: user ? "user" : "system",
    ip: req.ip,
    userAgent: req.get("user-agent"),
  };
}

export function changedFields(before: Document | null | undefined, after: Document | null | undefined) {
  return collectChangedFields(before ?? {}, after ?? {}).sort();
}

export async function recordAuditEvent(input: AuditEventInput) {
  const document: AuditLogDocument = {
    actorUserId: toObjectId(input.actorUserId),
    actorType: input.actorType ?? (input.actorUserId ? "user" : "system"),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    occurredAt: input.occurredAt ?? new Date(),
    ip: input.ip,
    userAgent: input.userAgent,
    before: input.before === undefined ? undefined : redactAuditDocument(input.before),
    after: input.after === undefined ? undefined : redactAuditDocument(input.after),
    details: input.details ? redactAuditDocument(input.details) : undefined,
  };

  await getCollection("audit_logs").insertOne(document);
}

export async function safeRecordAuditEvent(input: AuditEventInput) {
  try {
    await recordAuditEvent(input);
  } catch (error) {
    console.error("Failed to record audit event", error);
  }
}

export async function recordRequestAuditEvent(req: Request, user: AuthUser | undefined, input: Omit<AuditEventInput, keyof AuditContext>) {
  await safeRecordAuditEvent({
    ...getAuditContext(req, user),
    ...input,
  });
}
