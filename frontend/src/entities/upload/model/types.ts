import type { AnyRecord } from "../../types";

export type UploadBatch = {
  id: string;
  uploadId: string;
  createdAt: string;
  date: string;
  author: string;
  files: number;
  fileTypes: string;
  status: "success" | "warning" | "error";
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
