import { GridFSBucket, ObjectId, type Document } from "mongodb";

import { getDb } from "./client.js";

const BACKUP_PAYLOAD_BUCKET = "backup_payloads";

function getBackupPayloadBucket() {
  return new GridFSBucket(getDb(), { bucketName: BACKUP_PAYLOAD_BUCKET });
}

export async function storeBackupPayload(fileName: string, buffer: Buffer, metadata: Document = {}) {
  const bucket = getBackupPayloadBucket();
  const fileId = new ObjectId();

  await new Promise<void>((resolve, reject) => {
    const upload = bucket.openUploadStreamWithId(fileId, fileName, {
      contentType: "application/gzip",
      metadata,
    });
    upload.on("error", reject);
    upload.on("finish", () => resolve());
    upload.end(buffer);
  });

  return fileId;
}

export async function readBackupPayload(fileId: ObjectId) {
  const bucket = getBackupPayloadBucket();
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    const download = bucket.openDownloadStream(fileId);
    download.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    download.on("error", reject);
    download.on("end", () => resolve());
  });

  return Buffer.concat(chunks);
}

export async function deleteBackupPayload(fileId: ObjectId) {
  await getBackupPayloadBucket().delete(fileId);
}
