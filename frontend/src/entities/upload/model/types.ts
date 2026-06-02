import type { AnyRecord } from "../../types";

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
  startedAt?: string;
  finishedAt?: string;
  message?: string;
};

export type ProcessingState = {
  status: ProcessingStatus;
  currentStage?: string;
  progress: number;
  stages: ProcessingStageState[];
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  cancelRequestedAt?: string;
  lastHeartbeatAt?: string;
  attempt: number;
};

export type ProcessingStatusResponse = {
  ok: boolean;
  upload: AnyRecord & { processingState?: ProcessingState };
  processingLog: AnyRecord[];
  unresolvedStudents: AnyRecord[];
};

export type UploadBatch = {
  id: string;
  uploadId: string;
  createdAt: string;
  date: string;
  author: string;
  files: number;
  fileTypes: string;
  status: "success" | "warning" | "error" | ProcessingStatus | "pending" | "unknown";
  rowsCount: number;
  rows: string;
  studentsCount: number;
  students: string;
};

export type ProcessingLogRow = {
  id: number;
  timestampRaw: string;
  time: string;
  level: "info" | "warn" | "error";
  file: string;
  line: number;
  entityType: "student" | "moodle" | "camera";
  message: string;
  raw: AnyRecord;
};

export type ProblemRow = {
  file: string;
  line: number;
  content: string;
  error: string;
};

export type UnmappedStudent = {
  id: string;
  reason: string;
};
