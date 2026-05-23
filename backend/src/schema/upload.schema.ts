import type { ObjectId } from "mongodb";

export type UploadFile = {
  kind?: string;
  typeLabel?: string;
  originalName: string;
  storagePath: string;
  rowsCount?: number;
  status: string;
};

export type ProcessingLogEntry = {
  timestamp: Date;
  level: "info" | "warn" | "error" | string;
  sourceFileKey: string;
  line?: number;
  entityType: string;
  message: string;
};

export type UnresolvedStudent = {
  externalId: string;
  reason: string;
};

export type UploadDocument = {
  _id?: ObjectId;
  importBatchId?: ObjectId;
  datasetId?: string;
  userId: ObjectId;
  createdAt: Date;
  updateTime: Date;
  status: string;
  filesCount: number;
  totalRows: number;
  matchedStudents: number;
  files?: Record<string, UploadFile>;
  statusHistory?: Array<{
    oldStatus: string;
    newStatus: string;
    changedAt: Date;
    changedBy: string;
    reason: string;
  }>;
  processingLog?: ProcessingLogEntry[];
  unresolvedStudents?: UnresolvedStudent[];
};
