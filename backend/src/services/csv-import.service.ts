import { parse } from "csv-parse/sync";
import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { AuthUser } from "../schema/user.schema.js";

export type CsvImportKind = "students" | "sessions" | "moodle_events" | "ocr_events";

type CsvImportResult = {
  uploadId: ObjectId;
  importBatchId: ObjectId;
  kind: CsvImportKind;
  totalRows: number;
  insertedCount: number;
  errorCount: number;
  errors: Array<{ line: number; message: string }>;
};

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
  return parse(buffer, {
    bom: true,
    columns: true,
    delimiter: [",", ";"],
    skip_empty_lines: true,
    trim: true,
  }) as Document[];
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

async function createImportUpload(kind: CsvImportKind, user: AuthUser, now: Date, batchId?: string, originalName?: string) {
  const uploadId = new ObjectId();
  const importBatchId = batchId && ObjectId.isValid(batchId) ? new ObjectId(batchId) : new ObjectId();
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
      [kind]: { kind, typeLabel: kindLabels[kind], originalName: originalName ?? `${kind}.csv`, storagePath: "memory", status: "processing" },
    },
    processingLog: [{ timestamp: now, level: "info", sourceFileKey: kind, line: 1, entityType: "upload", message: `CSV импорт начат: ${kindLabels[kind]}` }],
    unresolvedStudents: [],
  });
  return { uploadId, importBatchId };
}

async function finishImportUpload(uploadId: ObjectId, kind: CsvImportKind, result: Omit<CsvImportResult, "uploadId" | "importBatchId" | "kind">, now: Date) {
  const logEntries = result.errors.slice(0, 100).map((error) => ({
    timestamp: now,
    level: "warn",
    sourceFileKey: kind,
    line: error.line,
    entityType: kind,
    message: error.message,
  }));

  await getCollection("uploads").updateOne(
    { _id: uploadId },
    {
      $set: {
        status: result.errorCount ? "done_with_warnings" : "done",
        updateTime: now,
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
      } as Document,
    } as Document,
  );
}

async function importStudents(rows: Document[], uploadId: ObjectId, importBatchId: ObjectId, now: Date) {
  const universityId = await ensureDefaultUniversity(now);
  const errors: CsvImportResult["errors"] = [];
  const documents = rows.flatMap<Document>((row, index): Document[] => {
    if (!row.externalId || !row.fullName || !row.email) {
      errors.push({ line: index + 2, message: "Обязательные поля: externalId, fullName, email" });
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
  return { insertedCount: documents.length, errors };
}

async function importSessions(rows: Document[], uploadId: ObjectId, importBatchId: ObjectId, now: Date) {
  const errors: CsvImportResult["errors"] = [];
  const externalIds = rows.map((row) => String(row.externalStudentId ?? "")).filter(Boolean);
  const students = await getCollection("students").find({ externalId: { $in: externalIds }, $or: [{ importBatchId }, { importBatchId: { $exists: false } }] }).toArray();
  const studentsByExternalId = new Map(students.map((student) => [String(student.externalId), student]));

  const documents = rows.flatMap((row, index) => {
    const student = studentsByExternalId.get(String(row.externalStudentId ?? ""));
    if (!student) {
      errors.push({ line: index + 2, message: `Студент ${String(row.externalStudentId ?? "")} не найден` });
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
  return { insertedCount: documents.length, errors };
}

async function importEvents(kind: Extract<CsvImportKind, "moodle_events" | "ocr_events">, rows: Document[], uploadId: ObjectId, importBatchId: ObjectId, now: Date) {
  const errors: CsvImportResult["errors"] = [];
  const externalIds = rows.map((row) => String(row.externalStudentId ?? "")).filter(Boolean);
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
    const student = studentsByExternalId.get(String(row.externalStudentId ?? ""));
    const session =
      row.sessionId && ObjectId.isValid(String(row.sessionId))
        ? sessions.find((item) => item._id.equals(new ObjectId(String(row.sessionId))))
        : firstSessionByStudentId.get(String(student?._id ?? ""));

    if (!student || !session) {
      errors.push({ line: index + 2, message: "Не найден студент или сессия для события" });
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
  return { insertedCount: documents.length, errors };
}

export async function importCsv(kind: CsvImportKind, buffer: Buffer, user: AuthUser, options: { batchId?: string; originalName?: string } = {}): Promise<CsvImportResult> {
  const now = new Date();
  const rows = parseCsv(buffer);
  const { uploadId, importBatchId } = await createImportUpload(kind, user, now, options.batchId, options.originalName);

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
  };
  await finishImportUpload(uploadId, kind, summary, new Date());

  return { uploadId, importBatchId, kind, ...summary };
}
