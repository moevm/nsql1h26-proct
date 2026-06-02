import type { AnyRecord } from "../../types";
import { formatDate, formatNumber } from "../../../shared/lib/format";
import type { ProcessingLogRow, UploadBatch } from "./types";

function uploadFileTypes(row: AnyRecord) {
  const files = (row.files ?? {}) as Record<string, AnyRecord>;
  return Object.entries(files)
    .map(([kind, file]) => String(file.typeLabel ?? file.kind ?? kind))
    .filter(Boolean);
}

function uploadStatus(row: AnyRecord): UploadBatch["status"] {
  const processingState = (row.processingState ?? {}) as AnyRecord;
  const processingStatus = String(processingState.status ?? "");
  if (["queued", "processing", "cancelling", "cancelled", "failed", "stale"].includes(processingStatus)) {
    return processingStatus as UploadBatch["status"];
  }
  const status = String(row.status ?? "success");
  const summary = (row.summary ?? {}) as AnyRecord;
  const errorCount = Number(row.errorCount ?? summary.errorCount ?? 0);
  if (status === "failed" || status === "error" || status === "stale") return "error";
  if (status === "pending") return "pending";
  if (status === "processing") return "processing";
  if (status === "cancelled") return "cancelled";
  if (status.includes("warning") || errorCount > 0) return "warning";
  return "success";
}

function statusPriority(status: UploadBatch["status"]) {
  if (status === "error" || status === "failed" || status === "stale") return 4;
  if (status === "processing" || status === "queued" || status === "cancelling") return 3;
  if (status === "warning" || status === "done_with_warnings" || status === "cancelled") return 2;
  if (status === "pending" || status === "idle") return 1;
  return 0;
}

export function mapUploadToBatch(row: AnyRecord): UploadBatch {
  const fileTypes = uploadFileTypes(row);
  const summary = (row.summary ?? {}) as AnyRecord;
  const rowsCount = Number(row.totalRows ?? summary.totalRows ?? summary.rows ?? 0);
  const studentsCount = Number(row.matchedStudents ?? summary.students ?? summary.studentCount ?? 0);
  return {
    id: String(row.importBatchId ?? row._id ?? ""),
    uploadId: String(row._id ?? ""),
    createdAt: String(row.createdAt ?? ""),
    date: formatDate(row.createdAt),
    author: String(row.createdByName ?? row.createdBy ?? "Система"),
    files: Number((row.filesCount ?? fileTypes.length) || 1),
    fileTypes: fileTypes.join(", ") || "Не указан",
    status: uploadStatus(row),
    rowsCount,
    rows: formatNumber(rowsCount),
    studentsCount,
    students: formatNumber(studentsCount),
  };
}

export function mapUploadsToBatches(rows: AnyRecord[]): UploadBatch[] {
  const grouped = new Map<
    string,
    {
      id: string;
      uploadId: string;
      createdAt: string;
      author: string;
      files: number;
      fileTypes: Set<string>;
      status: UploadBatch["status"];
      rows: number;
      students: number;
    }
  >();

  for (const row of rows) {
    const summary = (row.summary ?? {}) as AnyRecord;
    const id = String(row.importBatchId ?? row._id ?? "");
    if (!id) continue;
    const current = grouped.get(id);
    const status = uploadStatus(row);
    const fileTypes = uploadFileTypes(row);
    grouped.set(id, {
      id,
      uploadId: !current || statusPriority(status) > statusPriority(current.status) ? String(row._id ?? "") : current.uploadId,
      createdAt: current?.createdAt ?? String(row.createdAt ?? ""),
      author: current?.author ?? String(row.createdByName ?? row.createdBy ?? "Система"),
      files: (current?.files ?? 0) + Number((row.filesCount ?? fileTypes.length) || 1),
      fileTypes: new Set([...(current?.fileTypes ?? []), ...fileTypes]),
      status: !current || statusPriority(status) > statusPriority(current.status) ? status : current.status,
      rows: (current?.rows ?? 0) + Number(row.totalRows ?? summary.totalRows ?? summary.rows ?? 0),
      students: (current?.students ?? 0) + Number(row.matchedStudents ?? summary.students ?? summary.studentCount ?? 0),
    });
  }

  return [...grouped.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((batch) => ({
      id: batch.id,
      uploadId: batch.uploadId,
      createdAt: batch.createdAt,
      date: formatDate(batch.createdAt),
      author: batch.author,
      files: batch.files,
      fileTypes: [...batch.fileTypes].join(", ") || "Не указан",
      status: batch.status,
      rowsCount: batch.rows,
      rows: formatNumber(batch.rows),
      studentsCount: batch.students,
      students: formatNumber(batch.students),
    }));
}

export function mapUploadLogEntry(row: AnyRecord, index: number): ProcessingLogRow {
  const level = String(row.level ?? row.status ?? "info");
  const kind = String(row.kind ?? row.entityType ?? "student");
  const timestamp = row.timestamp ?? row.time ?? row.createdAt;
  return {
    id: index + 1,
    timestampRaw: timestamp ? String(timestamp) : "",
    time: timestamp ? new Date(String(timestamp)).toLocaleString("ru-RU") : "—",
    level: level === "error" ? "error" : level === "warn" || level === "warning" ? "warn" : "info",
    file: String(row.file ?? row.filename ?? row.sourceFileKey ?? row.source ?? "system"),
    line: Number(row.line ?? row.row ?? 0),
    entityType: kind.includes("ocr") || kind.includes("camera") ? "camera" : kind.includes("moodle") ? "moodle" : "student",
    message: String(row.message ?? row.error ?? row.status ?? "Запись обработана"),
    raw: row,
  };
}
