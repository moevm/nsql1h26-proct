import type { ObjectId } from "mongodb";

export type UploadFile = {
  kind?: string;
  typeLabel?: string;
  originalName: string;
  storagePath: string;
  sha256?: string;
  sizeBytes?: number;
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
  rowContent?: string;
};

export type UnresolvedStudent = {
  externalId: string;
  reason: string;
  possibleMatch?: string;
};

export type ProcessingStatus =
  | "idle"
  | "queued"
  | "processing"
  | "cancelling"
  | "cancelled"
  | "done"
  | "done_with_warnings"
  | "failed"
  | "stale";

export type ProcessingStageState = {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error" | "cancelled";
  startedAt?: Date;
  finishedAt?: Date;
  message?: string;
};

export type ProcessingState = {
  status: ProcessingStatus;
  currentStage?: string;
  progress: number;
  stages: ProcessingStageState[];
  startedAt?: Date;
  finishedAt?: Date;
  errorMessage?: string;
  cancelRequestedAt?: Date;
  lastHeartbeatAt?: Date;
  attempt: number;
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
  processingStartedAt?: Date;
  processingFinishedAt?: Date;
  processingState?: ProcessingState;
};
