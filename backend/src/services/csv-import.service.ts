import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { AuthUser } from "../schema/user.schema.js";
import type { UnresolvedStudent } from "../schema/upload.schema.js";
import { safeRecordAuditEvent, type AuditContext } from "./audit.service.js";
import { recordUploadStatusChange, mergeUnresolvedStudents } from "./upload-lifecycle.service.js";
import { persistUploadFile } from "./upload-storage.service.js";

export type CsvImportKind = "students" | "sessions" | "moodle_events" | "ocr_events";

type CsvImportError = {
  line: number;
  message: string;
  rowContent?: string;
};

type CsvImportResult = {
  uploadId: ObjectId;
  importBatchId: ObjectId;
  kind: CsvImportKind;
  totalRows: number;
  insertedCount: number;
  errorCount: number;
  errors: CsvImportError[];
};

class CsvValidationError extends Error {
  statusCode = 400;
}

class CsvDuplicateError extends Error {
  statusCode = 409;
}

const templates: Record<CsvImportKind, string[]> = {
  students: ["externalId", "recordBookNumber", "fullName", "email", "faculty", "program", "educationLevel", "group", "faceEmbedding"],
  sessions: [
    "externalStudentId",
    "examName",
    "startTime",
    "endTime",
    "durationMinutes",
    "totalActions",
    "actionsPerMinute",
    "faceAbsenceRate",
    "foreignFaceRate",
    "tabSwitchCount",
    "pasteEventCount",
    "anomalyScore",
    "riskLevel",
  ],
  moodle_events: ["externalStudentId", "sessionId", "eventTime", "action", "target", "courseName", "ip", "userAgent", "quizId", "questionId", "answer", "isCorrect", "timeSpent", "tabFocus"],
  ocr_events: ["externalStudentId", "sessionId", "eventTime", "frameIndex", "videoOffsetMs", "content", "confidence", "markdown"],
};

const requiredHeaders: Record<CsvImportKind, string[]> = {
  students: ["externalId", "fullName", "email"],
  sessions: ["externalStudentId", "examName", "startTime"],
  moodle_events: ["externalStudentId", "eventTime", "action", "target"],
  ocr_events: ["externalStudentId", "eventTime", "content", "confidence"],
};

const kindLabels: Record<CsvImportKind, string> = {
  students: "Справочник студентов",
  sessions: "Сессии экзаменов",
  moodle_events: "Журналы Moodle",
  ocr_events: "OCR и распознавание лиц",
};

export function isCsvImportKind(kind: string): kind is CsvImportKind {
  return Object.hasOwn(templates, kind);
}

export function getCsvTemplate(kind: CsvImportKind) {
  return `\uFEFF${templates[kind].join(";")}\n`;
}

export function getCsvTemplateFileName(kind: CsvImportKind) {
  return `${kind}_template.csv`;
}

function parseCsv(buffer: Buffer): Document[] {
  try {
    return parse(buffer, {
      bom: true,
      columns: true,
      delimiter: [",", ";"],
      skip_empty_lines: true,
      trim: true,
    }) as Document[];
  } catch (error) {
    throw new CsvValidationError(formatCsvParseError(error));
  }
}

function parseCsvHeaders(buffer: Buffer) {
  try {
    const records = parse(buffer, {
      bom: true,
      delimiter: [",", ";"],
      skip_empty_lines: true,
      to_line: 1,
      trim: true,
    }) as string[][];
    return records[0] ?? [];
  } catch (error) {
    throw new CsvValidationError(formatCsvParseError(error));
  }
}

function formatCsvParseError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const line = (error as { lines?: number } | undefined)?.lines ?? message.match(/line (\d+)/i)?.[1];
  const lineText = line ? `CSV строка ${line}` : "CSV файл";
  return `${lineText} содержит некорректное количество колонок. Если поле содержит запятые или точку с запятой, заключите его в кавычки.`;
}

function detectCsvKind(headers: Set<string>) {
  const matches = (Object.entries(requiredHeaders) as Array<[CsvImportKind, string[]]>)
    .map(([kind, required]) => ({ kind, matched: required.filter((header) => headers.has(header)).length, total: required.length }))
    .filter((match) => match.matched > 0)
    .sort((a, b) => (b.matched / b.total) - (a.matched / a.total) || b.matched - a.matched);
  return matches[0]?.matched === matches[0]?.total ? matches[0].kind : undefined;
}

function validateCsvHeaders(kind: CsvImportKind, headers: string[]) {
  const headerSet = new Set(headers.filter(Boolean));
  const missing = requiredHeaders[kind].filter((header) => !headerSet.has(header));
  if (!missing.length) return;

  const detectedKind = detectCsvKind(headerSet);
  const detectedHint = detectedKind && detectedKind !== kind
    ? ` Похоже, выбран файл типа "${kindLabels[detectedKind]}".`
    : "";
  throw new CsvValidationError(`CSV не соответствует типу "${kindLabels[kind]}". Не хватает колонок: ${missing.join(", ")}.${detectedHint}`);
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function ensureNotDuplicateCsv(kind: CsvImportKind, importBatchId: ObjectId, checksum: string) {
  const duplicate = await getCollection("uploads").findOne({
    importBatchId,
    [`files.${kind}.sha256`]: checksum,
  });
  if (!duplicate) return;
  throw new CsvDuplicateError(`Этот CSV уже загружен в активную пачку как ${kindLabels[kind]}.`);
}

function numberValue(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolValue(value: unknown) {
  return ["true", "1", "yes", "да"].includes(String(value ?? "").toLowerCase());
}

function dateValue(value: unknown, fallback = new Date()) {
  const parsed = value ? new Date(String(value)) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function parseEmbedding(value: unknown) {
  return String(value ?? "")
    .split(/[;| ]/)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
}

function serializeRowContent(row: Document, maxLength = 200) {
  const text = Object.values(row)
    .map((value) => String(value ?? ""))
    .join("; ");
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function findPrefixMatch(externalId: string, knownIds: string[]) {
  const normalized = externalId.trim().toLowerCase();
  if (!normalized) return undefined;

  const exactIgnoreCase = knownIds.find((id) => id.toLowerCase() === normalized);
  if (exactIgnoreCase) return exactIgnoreCase;

  return knownIds.find((id) => id.toLowerCase().startsWith(normalized) || normalized.startsWith(id.toLowerCase()));
}

async function loadKnownStudentExternalIds(importBatchId: ObjectId) {
  const students = await getCollection("students")
    .find({ $or: [{ importBatchId }, { importBatchId: { $exists: false } }] }, { projection: { externalId: 1 } })
    .toArray();
  return students.map((student) => String(student.externalId ?? "")).filter(Boolean);
}

function buildUnresolvedStudent(externalId: string, knownIds: string[]): UnresolvedStudent {
  const trimmed = externalId.trim();
  return {
    externalId: trimmed,
    reason: "Студент не найден в справочнике",
    possibleMatch: findPrefixMatch(trimmed, knownIds),
  };
}

async function ensureDefaultUniversity(now: Date) {
  const universities = getCollection("universities");
  const existing = await universities.findOne({ externalCode: "csv-default" });
  if (existing?._id) return existing._id as ObjectId;

  const result = await universities.insertOne({
    name: "CSV импорт",
    shortName: "CSV",
    externalCode: "csv-default",
    createdAt: now,
    updateTime: now,
  });
  return result.insertedId;
}

async function createImportUpload(
  kind: CsvImportKind,
  user: AuthUser,
  now: Date,
  uploadId: ObjectId,
  importBatchId: ObjectId,
  storagePath: string,
  fileMeta: { sha256: string; sizeBytes: number },
  originalName?: string,
  auditContext?: AuditContext,
) {
  await getCollection("uploads").insertOne({
    _id: uploadId,
    importBatchId,
    datasetId: String(importBatchId),
    userId: new ObjectId(user._id),
    createdAt: now,
    updateTime: now,
    status: "processing",
    filesCount: 1,
    totalRows: 0,
    matchedStudents: 0,
    files: {
      [kind]: { kind, typeLabel: kindLabels[kind], originalName: originalName ?? `${kind}.csv`, storagePath, status: "processing", ...fileMeta },
    },
    processingLog: [{ timestamp: now, level: "info", sourceFileKey: kind, line: 1, entityType: "upload", message: `CSV импорт начат: ${kindLabels[kind]}` }],
    unresolvedStudents: [],
    processingStartedAt: now,
  });
  await safeRecordAuditEvent({
    ...auditContext,
    actorUserId: new ObjectId(user._id),
    actorType: "user",
    action: "upload.import_start",
    entityType: "upload",
    entityId: uploadId,
    occurredAt: now,
    details: { kind, importBatchId: String(importBatchId) },
  });
  return { uploadId, importBatchId };
}

async function finishImportUpload(
  uploadId: ObjectId,
  kind: CsvImportKind,
  result: Omit<CsvImportResult, "uploadId" | "importBatchId" | "kind"> & { unresolvedStudents?: UnresolvedStudent[] },
  now: Date,
  userId: ObjectId,
  auditContext?: AuditContext,
) {
  const current = await getCollection("uploads").findOne({ _id: uploadId });
  const newStatus = result.errorCount ? "done_with_warnings" : "done";
  const historyEntry = await recordUploadStatusChange({
    uploadId,
    oldStatus: String(current?.status ?? "processing"),
    newStatus,
    userId,
    reason: result.errorCount ? "CSV импорт завершен с предупреждениями" : "CSV импорт завершен",
    details: { kind, errorCount: result.errorCount },
    auditContext,
  });

  const logEntries = result.errors.slice(0, 100).map((error) => ({
    timestamp: now,
    level: "warn",
    sourceFileKey: kind,
    line: error.line,
    entityType: kind,
    message: error.message,
    rowContent: error.rowContent,
  }));

  const update: Document = {
    $set: {
      status: newStatus,
      updateTime: now,
      processingFinishedAt: now,
      totalRows: result.totalRows,
      matchedStudents: result.insertedCount,
      [`files.${kind}.rowsCount`]: result.totalRows,
      [`files.${kind}.status`]: result.errorCount ? "warning" : "done",
    },
    $push: {
      processingLog: {
        $each: [
          ...logEntries,
          {
            timestamp: now,
            level: result.errorCount ? "warn" : "info",
            sourceFileKey: kind,
            line: result.totalRows,
            entityType: kind,
            message: `CSV импорт завершен: добавлено ${result.insertedCount}, ошибок ${result.errorCount}`,
          },
        ],
      },
    },
  };

  if (historyEntry) {
    update.$push.statusHistory = historyEntry;
  }

  if (result.unresolvedStudents?.length) {
    update.$set.unresolvedStudents = mergeUnresolvedStudents(
      (current?.unresolvedStudents as UnresolvedStudent[] | undefined) ?? [],
      result.unresolvedStudents,
    );
  }

  await getCollection("uploads").updateOne({ _id: uploadId }, update as Document);
}

async function importStudents(rows: Document[], uploadId: ObjectId, importBatchId: ObjectId, now: Date) {
  const universityId = await ensureDefaultUniversity(now);
  const errors: CsvImportError[] = [];
  const documents = rows.flatMap<Document>((row, index): Document[] => {
    if (!row.externalId || !row.fullName || !row.email) {
      errors.push({
        line: index + 2,
        message: "Обязательные поля: externalId, fullName, email",
        rowContent: serializeRowContent(row),
      });
      return [];
    }
    return [
      {
        uploadId,
        importBatchId,
        universityId,
        externalId: String(row.externalId),
        recordBookNumber: String(row.recordBookNumber ?? ""),
        fullName: String(row.fullName),
        email: String(row.email),
        faculty: String(row.faculty ?? "ФКТИ"),
        program: String(row.program ?? "Прикладная информатика"),
        educationLevel: String(row.educationLevel ?? "bachelor"),
        group: String(row.group ?? ""),
        faceEmbedding: parseEmbedding(row.faceEmbedding),
        createdAt: now,
        updateTime: now,
      },
    ];
  });

  if (documents.length) await getCollection("students").insertMany(documents);
  return { insertedCount: documents.length, errors, unresolvedStudents: [] as UnresolvedStudent[] };
}

async function importSessions(rows: Document[], uploadId: ObjectId, importBatchId: ObjectId, now: Date) {
  const errors: CsvImportError[] = [];
  const unresolvedMap = new Map<string, UnresolvedStudent>();
  const externalIds = rows.map((row) => String(row.externalStudentId ?? "")).filter(Boolean);
  const knownIds = await loadKnownStudentExternalIds(importBatchId);
  const students = await getCollection("students").find({ externalId: { $in: externalIds }, $or: [{ importBatchId }, { importBatchId: { $exists: false } }] }).toArray();
  const studentsByExternalId = new Map(students.map((student) => [String(student.externalId), student]));

  const documents = rows.flatMap((row, index) => {
    const externalStudentId = String(row.externalStudentId ?? "");
    const student = studentsByExternalId.get(externalStudentId);
    if (!student) {
      errors.push({
        line: index + 2,
        message: `Студент ${externalStudentId} не найден`,
        rowContent: serializeRowContent(row),
      });
      if (externalStudentId && !unresolvedMap.has(externalStudentId)) {
        unresolvedMap.set(externalStudentId, buildUnresolvedStudent(externalStudentId, knownIds));
      }
      return [];
    }

    const startTime = dateValue(row.startTime, now);
    const endTime = dateValue(row.endTime, new Date(startTime.getTime() + 60 * 60_000));
    const durationMinutes = numberValue(row.durationMinutes, (endTime.getTime() - startTime.getTime()) / 60_000);
    const totalActions = numberValue(row.totalActions, 80);
    const actionsPerMinute = numberValue(row.actionsPerMinute, Number((totalActions / Math.max(durationMinutes, 1)).toFixed(2)));
    const faceAbsenceRate = numberValue(row.faceAbsenceRate, 0.03);
    const foreignFaceRate = numberValue(row.foreignFaceRate, 0);
    const tabSwitchCount = numberValue(row.tabSwitchCount, 0);
    const pasteEventCount = numberValue(row.pasteEventCount, 0);
    const anomalyScore = numberValue(row.anomalyScore, 0.15);

    return [
      {
        uploadId,
        importBatchId,
        studentId: student._id,
        startTime,
        endTime,
        durationMinutes,
        examName: String(row.examName ?? "CSV импорт экзамена"),
        metrics: {
          moodle: { totalActions, actionsPerMinute, tabSwitchCount, pasteEventCount },
          ocr: { faceAbsenceRate, foreignFaceRate },
          combined: { anomalyScore, riskLevel: String(row.riskLevel ?? (anomalyScore > 0.7 ? "high" : anomalyScore > 0.35 ? "medium" : "low")) },
        },
        featureVector: [totalActions, actionsPerMinute, tabSwitchCount, pasteEventCount, faceAbsenceRate, foreignFaceRate, anomalyScore, durationMinutes],
        createdAt: now,
        updateTime: now,
      },
    ];
  });

  if (documents.length) await getCollection("sessions").insertMany(documents);
  return { insertedCount: documents.length, errors, unresolvedStudents: [...unresolvedMap.values()] };
}

async function importEvents(kind: Extract<CsvImportKind, "moodle_events" | "ocr_events">, rows: Document[], uploadId: ObjectId, importBatchId: ObjectId, now: Date) {
  const errors: CsvImportError[] = [];
  const unresolvedMap = new Map<string, UnresolvedStudent>();
  const externalIds = rows.map((row) => String(row.externalStudentId ?? "")).filter(Boolean);
  const knownIds = await loadKnownStudentExternalIds(importBatchId);
  const students = await getCollection("students").find({ externalId: { $in: externalIds }, $or: [{ importBatchId }, { importBatchId: { $exists: false } }] }).toArray();
  const studentsByExternalId = new Map(students.map((student) => [String(student.externalId), student]));
  const studentIds = students.map((student) => student._id);
  const sessions = await getCollection("sessions").find({ studentId: { $in: studentIds }, $or: [{ importBatchId }, { importBatchId: { $exists: false } }] }).sort({ startTime: -1 }).toArray();
  const firstSessionByStudentId = new Map<string, Document>();
  for (const session of sessions) {
    const key = String(session.studentId);
    if (!firstSessionByStudentId.has(key)) firstSessionByStudentId.set(key, session);
  }

  const documents = rows.flatMap((row, index) => {
    const externalStudentId = String(row.externalStudentId ?? "");
    const student = studentsByExternalId.get(externalStudentId);
    const session =
      row.sessionId && ObjectId.isValid(String(row.sessionId))
        ? sessions.find((item) => item._id.equals(new ObjectId(String(row.sessionId))))
        : firstSessionByStudentId.get(String(student?._id ?? ""));

    if (!student) {
      errors.push({
        line: index + 2,
        message: "Не найден студент для события",
        rowContent: serializeRowContent(row),
      });
      if (externalStudentId && !unresolvedMap.has(externalStudentId)) {
        unresolvedMap.set(externalStudentId, buildUnresolvedStudent(externalStudentId, knownIds));
      }
      return [];
    }

    if (!session) {
      errors.push({
        line: index + 2,
        message: "Не найдена сессия для события",
        rowContent: serializeRowContent(row),
      });
      return [];
    }

    const base = {
      uploadId,
      importBatchId,
      studentId: student._id,
      sessionId: session._id,
      eventTime: dateValue(row.eventTime, now),
      createdAt: now,
      updateTime: now,
    };

    if (kind === "moodle_events") {
      return [
        {
          ...base,
          eventType: "moodle",
          sourceFileKey: "moodle_csv",
          moodle: {
            action: String(row.action ?? "view"),
            target: String(row.target ?? "Страница курса"),
            courseName: String(row.courseName ?? "CSV курс"),
            ip: String(row.ip ?? "127.0.0.1"),
            userAgent: String(row.userAgent ?? "csv-import"),
            quizId: String(row.quizId ?? ""),
            questionId: String(row.questionId ?? ""),
            answer: String(row.answer ?? ""),
            isCorrect: boolValue(row.isCorrect),
            timeSpent: numberValue(row.timeSpent, 0),
            tabFocus: row.tabFocus === undefined ? true : boolValue(row.tabFocus),
          },
        } as Document,
      ];
    }

    return [
      {
        ...base,
        eventType: "ocr_frame",
        sourceFileKey: "ocr_csv",
        ocr: {
          frameIndex: numberValue(row.frameIndex, index),
          videoOffsetMs: numberValue(row.videoOffsetMs, index * 1000),
          blocks: [
            {
              label: "text",
              content: String(row.content ?? ""),
              bbox: [0, 0, 100, 40],
              confidence: numberValue(row.confidence, 0.9),
              order: 1,
            },
          ],
          markdown: String(row.markdown ?? row.content ?? ""),
        },
      } as Document,
    ];
  });

  if (documents.length) await getCollection("timeline_events").insertMany(documents);
  return { insertedCount: documents.length, errors, unresolvedStudents: [...unresolvedMap.values()] };
}

export async function importCsv(
  kind: CsvImportKind,
  buffer: Buffer,
  user: AuthUser,
  options: { batchId?: string; originalName?: string; auditContext?: AuditContext } = {},
): Promise<CsvImportResult> {
  const now = new Date();
  const headers = parseCsvHeaders(buffer);
  validateCsvHeaders(kind, headers);
  const rows = parseCsv(buffer);
  const uploadId = new ObjectId();
  const importBatchId = options.batchId && ObjectId.isValid(options.batchId) ? new ObjectId(options.batchId) : new ObjectId();
  const fileMeta = { sha256: sha256(buffer), sizeBytes: buffer.byteLength };
  await ensureNotDuplicateCsv(kind, importBatchId, fileMeta.sha256);
  const storagePath = await persistUploadFile(buffer, uploadId, kind, options.originalName);
  await createImportUpload(kind, user, now, uploadId, importBatchId, storagePath, fileMeta, options.originalName, options.auditContext);

  const imported =
    kind === "students"
      ? await importStudents(rows, uploadId, importBatchId, now)
      : kind === "sessions"
        ? await importSessions(rows, uploadId, importBatchId, now)
        : await importEvents(kind, rows, uploadId, importBatchId, now);

  const summary = {
    totalRows: rows.length,
    insertedCount: imported.insertedCount,
    errorCount: imported.errors.length,
    errors: imported.errors,
    unresolvedStudents: imported.unresolvedStudents,
  };
  await finishImportUpload(uploadId, kind, summary, new Date(), new ObjectId(user._id), options.auditContext);

  return { uploadId, importBatchId, kind, ...summary };
}
