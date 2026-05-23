import type { Document, ObjectId } from "mongodb";

export type AuditLogDocument = {
  _id?: ObjectId;
  actorUserId?: ObjectId;
  actorType: string;
  action: string;
  entityType: string;
  entityId?: string | ObjectId;
  occurredAt: Date;
  ip?: string;
  userAgent?: string;
  before?: Document | null;
  after?: Document | null;
  details?: Document;
};
