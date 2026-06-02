import type { AuthUser } from "../schema/user.schema.js";
import { createDemoUpload } from "../queries/upload.queries.js";
import type { AuditContext } from "./audit.service.js";
import { getProcessingStatus, retryProcessing, startProcessing, stopProcessing } from "./processing.service.js";

export function createDemoImport(user: AuthUser, auditContext?: AuditContext) {
  return createDemoUpload(user, auditContext);
}

export async function processUpload(uploadId: string, user: AuthUser, auditContext?: AuditContext) {
  return startProcessing(uploadId, user, auditContext);
}

export function getUploadProcessingStatus(uploadId: string, user: AuthUser) {
  return getProcessingStatus(uploadId, user);
}

export function stopUploadProcessing(uploadId: string, user: AuthUser) {
  return stopProcessing(uploadId, user);
}

export function retryUploadProcessing(uploadId: string, user: AuthUser, auditContext?: AuditContext) {
  return retryProcessing(uploadId, user, auditContext);
}
