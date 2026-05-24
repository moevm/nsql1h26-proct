export type UploadBatch = {
  id: string;
  uploadId: string;
  date: string;
  author: string;
  files: number;
  fileTypes: string;
  status: "success" | "warning" | "error";
  rows: string;
  students: string;
};

export type ProcessingLogRow = {
  id: number;
  time: string;
  level: "info" | "warn" | "error";
  file: string;
  line: number;
  entityType: "student" | "moodle" | "camera";
  message: string;
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
