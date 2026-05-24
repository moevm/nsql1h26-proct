import type { AuthUser } from "../schema/user.schema.js";
import { createDemoUpload, markUploadProcessed } from "../queries/upload.queries.js";

export function createDemoImport(user: AuthUser) {
  return createDemoUpload(user);
}

export async function processUpload(uploadId: string) {
  await markUploadProcessed(uploadId);
  return { ok: true };
}
