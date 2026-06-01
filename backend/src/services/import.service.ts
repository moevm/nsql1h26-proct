import type { AuthUser } from "../schema/user.schema.js";
import { createDemoUpload, markUploadProcessed } from "../queries/upload.queries.js";
import type { AuditContext } from "./audit.service.js";

export function createDemoImport(user: AuthUser, auditContext?: AuditContext) {
  return createDemoUpload(user, auditContext);
}

export async function processUpload(uploadId: string, user: AuthUser, auditContext?: AuditContext) {
  const processedCount = await markUploadProcessed(uploadId, user, auditContext);
  return { ok: true, processedCount };
}
