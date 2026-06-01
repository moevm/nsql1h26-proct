import fs from "node:fs/promises";
import path from "node:path";
import type { ObjectId } from "mongodb";

import { env } from "../config/env.js";

export function getUploadStorageDir(uploadId: ObjectId) {
  return `${env.UPLOAD_DIR}/${uploadId.toHexString()}`;
}

export async function removeUploadStorageDir(uploadId: ObjectId) {
  await fs.rm(getUploadStorageDir(uploadId), { recursive: true, force: true });
}

export async function persistUploadFile(buffer: Buffer, uploadId: ObjectId, kind: string, originalName?: string) {
  const dir = getUploadStorageDir(uploadId);
  await fs.mkdir(dir, { recursive: true });
  const safeName = path.basename(originalName ?? `${kind}.csv`).replace(/[^\w.\-()+\u0400-\u04FF]/g, "_");
  const storagePath = path.join(dir, safeName);
  await fs.writeFile(storagePath, buffer);
  return storagePath;
}
