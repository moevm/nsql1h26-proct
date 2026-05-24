import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import { entityNames } from "../schema/entity.schema.js";
import type { FeatureSession } from "../schema/session.schema.js";
import { runDbscanLike, runKMeans } from "./clustering.service.js";

const fullNames = [
  "Иванов Петр Сергеевич",
  "Бубякина Юлия Владимировна",
  "Смирнов Олег Андреевич",
  "Петрова Анна Игоревна",
  "Кузнецов Максим Павлович",
  "Соколова Мария Денисовна",
  "Морозов Артем Ильич",
  "Васильева Алиса Романовна",
];

const groups = ["3344", "3530901/10101", "3530901/10102", "3307", "3381"];
const exams = ["Введение в нереляционные БД", "Алгоритмы анализа данных", "Информационные системы", "Машинное обучение"];

function rounded(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

function makeFeatureVector(metrics: {
  totalActions: number;
  actionsPerMinute: number;
  tabSwitchCount: number;
  pasteEventCount: number;
  faceAbsenceRate: number;
  foreignFaceRate: number;
  faceSwapCount: number;
  anomalyScore: number;
  durationMinutes: number;
}) {
  return [
    metrics.totalActions,
    metrics.actionsPerMinute,
    metrics.tabSwitchCount,
    metrics.pasteEventCount,
    metrics.faceAbsenceRate,
    metrics.foreignFaceRate,
    metrics.faceSwapCount,
    metrics.anomalyScore,
    metrics.durationMinutes,
  ];
}

export async function seedLargeDemoData(options: { reset?: boolean } = {}) {
  const now = new Date();

  if (options.reset) {
    for (const entity of [...entityNames].reverse()) {
      await getCollection(entity).deleteMany({});
    }
  }

  const passwordHash = await bcrypt.hash("password", 10);
  const adminId = new ObjectId();
  const teacherId = new ObjectId();
  const universityId = new ObjectId();
  const uploadId = new ObjectId();

  await getCollection("users").insertMany([
    { _id: adminId, email: "admin@example.com", passwordHash, fullName: "Администратор", role: "admin", createdAt: now, updateTime: now },
    { _id: teacherId, email: "teacher@example.com", passwordHash, fullName: "Преподаватель", role: "teacher", createdAt: now, updateTime: now },
  ]);

  await getCollection("universities").insertOne({
    _id: universityId,
    name: "Санкт-Петербургский государственный электротехнический университет ЛЭТИ",
    shortName: "ЛЭТИ",
    externalCode: "etu",
    createdAt: now,
    updateTime: now,
  });

  const students = Array.from({ length: 300 }, (_, index) => ({
    _id: new ObjectId(),
    uploadId,
    universityId,
    externalId: `STU_${String(index + 1).padStart(4, "0")}`,
    recordBookNumber: `26-${String(index + 1).padStart(4, "0")}`,
    fullName: `${pick(fullNames, index)} ${index + 1}`,
    email: `student${index + 1}@etu.ru`,
    faculty: index % 3 === 0 ? "ФКТИ" : index % 3 === 1 ? "ФЭА" : "ФИБС",
    program: index % 2 === 0 ? "Прикладная информатика" : "Программная инженерия",
    educationLevel: index % 5 === 0 ? "master" : "bachelor",
    group: pick(groups, index),
    faceEmbedding: [rounded(index * 0.01), rounded(Math.sin(index), 4), rounded(Math.cos(index), 4), rounded((index % 7) / 10)],
    createdAt: now,
    updateTime: now,
  }));

  const sessions = students.flatMap((student, studentIndex) =>
    Array.from({ length: 3 }, (_, attemptIndex) => {
      const sessionIndex = studentIndex * 3 + attemptIndex;
      const startTime = new Date(Date.UTC(2026, 2, 1 + (sessionIndex % 21), 9 + (sessionIndex % 8), (sessionIndex * 7) % 60));
      const durationMinutes = 45 + (sessionIndex % 70);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
      const totalActions = 55 + (sessionIndex % 160);
      const actionsPerMinute = rounded(totalActions / durationMinutes);
      const tabSwitchCount = sessionIndex % 9;
      const pasteEventCount = sessionIndex % 17 === 0 ? 4 : sessionIndex % 5 === 0 ? 1 : 0;
      const faceAbsenceRate = rounded(sessionIndex % 23 === 0 ? 0.48 : (sessionIndex % 12) / 100);
      const foreignFaceRate = rounded(sessionIndex % 37 === 0 ? 0.32 : 0);
      const faceSwapCount = sessionIndex % 41 === 0 ? 3 : 0;
      const anomalyScore = rounded(Math.min(0.98, faceAbsenceRate + foreignFaceRate + tabSwitchCount / 25 + pasteEventCount / 10 + faceSwapCount / 5));
      const riskLevel = anomalyScore > 0.7 ? "high" : anomalyScore > 0.35 ? "medium" : "low";
      const metrics = { totalActions, actionsPerMinute, tabSwitchCount, pasteEventCount, faceAbsenceRate, foreignFaceRate, faceSwapCount, anomalyScore, durationMinutes };

      return {
        _id: new ObjectId(),
        uploadId,
        studentId: student._id,
        startTime,
        endTime,
        durationMinutes,
        examName: `${pick(exams, sessionIndex)} -- попытка ${attemptIndex + 1}`,
        metrics: {
          moodle: {
            totalActions,
            actionsPerMinute,
            viewToSubmitRatio: rounded(1.2 + (sessionIndex % 15) / 10),
            pageTransitions: 12 + (sessionIndex % 50),
            uniquePagesVisited: 8 + (sessionIndex % 18),
            avgTimePerQuestion: 75 + (sessionIndex % 160),
            tabSwitchCount,
            correctAnswerRate: rounded(0.45 + (sessionIndex % 50) / 100),
            idleIntervals: sessionIndex % 6,
            pasteEventCount,
          },
          ocr: {
            totalFramesAnalyzed: 40 + (sessionIndex % 80),
            faceAbsenceRate,
            foreignFaceRate,
            faceSwapCount,
            avgFaceConfidence: rounded(0.98 - faceAbsenceRate / 2),
            suspiciousTextDetected: sessionIndex % 7,
            screenContentChanges: 8 + (sessionIndex % 30),
            avgBlocksPerFrame: rounded(6 + (sessionIndex % 12) / 2),
          },
          combined: { anomalyScore, riskLevel },
        },
        featureVector: makeFeatureVector(metrics),
        createdAt: now,
        updateTime: now,
      };
    }),
  );

  const timelineEvents = sessions.flatMap((session, sessionIndex) =>
    Array.from({ length: 10 }, (_, eventIndex) => {
      const isOcr = eventIndex % 2 === 0;
      const eventTime = new Date(session.startTime.getTime() + eventIndex * 4 * 60_000);
      return {
        _id: new ObjectId(),
        uploadId,
        studentId: session.studentId,
        sessionId: session._id,
        eventType: isOcr ? "ocr_frame" : "moodle",
        eventTime,
        sourceFileKey: isOcr ? "screencast_csv" : "moodle_log_csv",
        ...(isOcr
          ? {
              ocr: {
                frameIndex: sessionIndex * 10 + eventIndex,
                videoOffsetMs: eventIndex * 240_000,
                blocks: [
                  {
                    label: eventIndex % 6 === 0 ? "suspicious_text" : "text",
                    content: eventIndex % 6 === 0 ? "Открыта вкладка с подсказками" : "Страница теста Moodle",
                    bbox: [120, 80, 900, 180],
                    confidence: rounded(0.72 + (eventIndex % 20) / 100),
                    order: 1,
                  },
                ],
                markdown: eventIndex % 6 === 0 ? "## Подозрительный текст" : "## Тест Moodle",
              },
            }
          : {
              moodle: {
                action: eventIndex === 9 ? "submit" : eventIndex % 3 === 0 ? "answer" : "view",
                target: `Вопрос ${eventIndex + 1}`,
                courseName: "NoSQL и анализ данных",
                ip: `10.0.${sessionIndex % 255}.${eventIndex + 10}`,
                userAgent: "Mozilla/5.0 csv-seed",
                quizId: `quiz_${sessionIndex % 12}`,
                questionId: `q_${eventIndex}`,
                answer: eventIndex === 9 ? "final" : "",
                isCorrect: eventIndex % 4 !== 0,
                timeSpent: 60 + eventIndex * 15,
                tabFocus: eventIndex % 5 !== 0,
              },
            }),
        createdAt: now,
        updateTime: now,
      };
    }),
  );

  await getCollection("uploads").insertOne({
    _id: uploadId,
    userId: teacherId,
    createdAt: now,
    updateTime: now,
    status: "done",
    filesCount: 4,
    totalRows: students.length + sessions.length + timelineEvents.length,
    matchedStudents: students.length,
    files: {
      students_csv: { originalName: "students_large.csv", storagePath: "uploads/demo/students_large.csv", rowsCount: students.length, status: "done" },
      sessions_csv: { originalName: "sessions_large.csv", storagePath: "uploads/demo/sessions_large.csv", rowsCount: sessions.length, status: "done" },
      moodle_log_csv: { originalName: "moodle_large.csv", storagePath: "uploads/demo/moodle_large.csv", rowsCount: timelineEvents.length / 2, status: "done" },
      ocr_csv: { originalName: "ocr_large.csv", storagePath: "uploads/demo/ocr_large.csv", rowsCount: timelineEvents.length / 2, status: "done" },
    },
    statusHistory: [{ oldStatus: "processing", newStatus: "done", changedAt: now, changedBy: "system", reason: "Большой seed завершен" }],
    processingLog: [
      { timestamp: now, level: "info", sourceFileKey: "students_csv", line: students.length, entityType: "student", message: `Импортировано студентов: ${students.length}` },
      { timestamp: now, level: "info", sourceFileKey: "sessions_csv", line: sessions.length, entityType: "session", message: `Импортировано сессий: ${sessions.length}` },
      { timestamp: now, level: "info", sourceFileKey: "events_csv", line: timelineEvents.length, entityType: "timeline_event", message: `Импортировано событий: ${timelineEvents.length}` },
    ],
    unresolvedStudents: [
      { externalId: "STU_9999", reason: "Нет в справочнике студентов" },
      { externalId: "STU_9998", reason: "Отсутствует эталонный эмбеддинг" },
    ],
  });

  await getCollection("students").insertMany(students);
  await getCollection("sessions").insertMany(sessions);
  await getCollection("timeline_events").insertMany(timelineEvents);

  const clusteringInputs = [
    { algorithm: "kmeans", items: sessions.slice(0, 180) as FeatureSession[], k: 3 },
    { algorithm: "kmeans", items: sessions.slice(180, 420) as FeatureSession[], k: 4 },
    { algorithm: "dbscan", items: sessions.slice(420, 620) as FeatureSession[], k: 3 },
    { algorithm: "kmeans", items: sessions.slice(620, 780) as FeatureSession[], k: 5 },
    { algorithm: "dbscan", items: sessions.slice(780) as FeatureSession[], k: 3 },
  ];

  const runs = clusteringInputs.map((input, index) => {
    const computed = input.algorithm === "dbscan" ? runDbscanLike(input.items) : runKMeans(input.items, input.k);
    const anomalyCount = computed.assignments.filter((item) => item.isAnomaly).length;
    const startedAt = new Date(Date.UTC(2026, 2, 22 + index, 10 + index, 5));
    return {
      _id: new ObjectId(),
      userId: teacherId,
      uploadIds: [uploadId],
      startedAt,
      finishedAt: new Date(startedAt.getTime() + (90 + index * 25) * 1000),
      createdAt: now,
      updateTime: now,
      status: "done",
      statusHistory: [{ oldStatus: "running", newStatus: "done", changedAt: now, changedBy: "system", reason: "Seed кластеризация" }],
      algorithm: input.algorithm,
      parameters: { k: input.k, distanceMetric: "euclidean", selectedFeatures: ["totalActions", "actionsPerMinute", "faceAbsenceRate", "anomalyScore"] },
      filter: { dateFrom: new Date(Date.UTC(2026, 2, 1)), dateTo: new Date(Date.UTC(2026, 2, 31)), uploadIds: [uploadId] },
      results: {
        totalSessions: input.items.length,
        clusterCount: computed.clusters.length,
        anomalyCount,
        anomalyRate: rounded(anomalyCount / input.items.length, 3),
        silhouetteScore: input.algorithm === "dbscan" ? 0.62 : 0.74,
        clusters: computed.clusters,
        sessionAssignments: computed.assignments,
      },
    };
  });

  await getCollection("clustering_runs").insertMany(runs);
  await getCollection("audit_logs").insertOne({
    actorUserId: teacherId,
    actorType: "user",
    action: "seed.large.create",
    entityType: "database",
    entityId: "large-seed",
    occurredAt: now,
    ip: "127.0.0.1",
    userAgent: "seed",
    before: null,
    after: { status: "done" },
    details: { students: students.length, sessions: sessions.length, timelineEvents: timelineEvents.length, clusteringRuns: runs.length },
  });

  return { students: students.length, sessions: sessions.length, timelineEvents: timelineEvents.length, clusteringRuns: runs.length };
}
