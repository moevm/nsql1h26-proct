import type { Document } from "mongodb";

import { getCollection } from "../db/collections.js";
import { canReadEntity, buildEntityListFilter } from "./entity.queries.js";
import type { EntityName } from "../schema/entity.schema.js";
import type { AuthUser } from "../schema/user.schema.js";
import { getQuery, type QuerySource } from "../utils/query.js";

type StatisticsEntity = "users" | "universities" | "uploads" | "students" | "events" | "sessions" | "runs" | "audit";

type StatisticsField = {
  key: string;
  label: string;
};

const statisticsConfig: Record<StatisticsEntity, { entity: EntityName; fields: StatisticsField[]; defaultX: string; defaultY: string }> = {
  users: {
    entity: "users",
    defaultX: "role",
    defaultY: "createdAt",
    fields: [
      { key: "fullName", label: "ФИО" },
      { key: "email", label: "Email" },
      { key: "role", label: "Роль" },
      { key: "createdAt", label: "Дата/время создания" },
    ],
  },
  universities: {
    entity: "universities",
    defaultX: "shortName",
    defaultY: "externalCode",
    fields: [
      { key: "name", label: "Название" },
      { key: "shortName", label: "Кратко" },
      { key: "externalCode", label: "Код" },
    ],
  },
  uploads: {
    entity: "uploads",
    defaultX: "status",
    defaultY: "createdAt",
    fields: [
      { key: "status", label: "Статус" },
      { key: "filesCount", label: "Файлов" },
      { key: "totalRows", label: "Строк" },
      { key: "matchedStudents", label: "Студентов" },
      { key: "createdAt", label: "Создана" },
    ],
  },
  sessions: {
    entity: "sessions",
    defaultX: "student.group",
    defaultY: "metrics.combined.riskLevel",
    fields: [
      { key: "examName", label: "Экзамен" },
      { key: "durationMinutes", label: "Длительность" },
      { key: "metrics.combined.riskLevel", label: "Уровень риска" },
      { key: "metrics.combined.anomalyScore", label: "Балл аномальности" },
      { key: "student.group", label: "Группа студента" },
      { key: "student.program", label: "Программа студента" },
      { key: "student.educationLevel", label: "Уровень обучения" },
    ],
  },
  students: {
    entity: "students",
    defaultX: "group",
    defaultY: "educationLevel",
    fields: [
      { key: "faculty", label: "Факультет" },
      { key: "program", label: "Программа" },
      { key: "educationLevel", label: "Уровень обучения" },
      { key: "group", label: "Группа" },
    ],
  },
  events: {
    entity: "timeline_events",
    defaultX: "eventType",
    defaultY: "student.group",
    fields: [
      { key: "eventType", label: "Тип" },
      { key: "sourceFileKey", label: "Файл" },
      { key: "moodle.action", label: "Действие Moodle" },
      { key: "moodle.courseName", label: "Имя курса" },
      { key: "moodle.target", label: "Цель Moodle" },
      { key: "moodle.timeSpent", label: "Время на вопрос" },
      { key: "student.group", label: "Группа студента" },
      { key: "student.program", label: "Программа студента" },
      { key: "student.educationLevel", label: "Уровень обучения" },
    ],
  },
  runs: {
    entity: "clustering_runs",
    defaultX: "algorithm",
    defaultY: "status",
    fields: [
      { key: "algorithm", label: "Алгоритм" },
      { key: "status", label: "Статус" },
      { key: "results.totalSessions", label: "Сессий" },
      { key: "results.clusterCount", label: "Кластеров" },
      { key: "results.anomalyCount", label: "Аномалий" },
      { key: "results.anomalyRate", label: "Доля аномалий" },
    ],
  },
  audit: {
    entity: "audit_logs",
    defaultX: "actorType",
    defaultY: "entityType",
    fields: [
      { key: "actorType", label: "Субъект" },
      { key: "action", label: "Действие" },
      { key: "entityType", label: "Сущность" },
      { key: "ip", label: "IP" },
      { key: "userAgent", label: "User-Agent" },
      { key: "occurredAt", label: "Время" },
    ],
  },
};

function statisticsEntity(value: string | undefined): StatisticsEntity {
  return value && value in statisticsConfig ? (value as StatisticsEntity) : "sessions";
}

function allowedField(entity: StatisticsEntity, value: string | undefined, fallback: string) {
  const allowed = new Set(statisticsConfig[entity].fields.map((field) => field.key));
  return value && allowed.has(value) ? value : fallback;
}

function expressionForField(field: string) {
  return { $ifNull: [`$${field}`, "Не задано"] };
}

export async function getStatistics(query: QuerySource, user: AuthUser) {
  const requestedEntity = statisticsEntity(getQuery(query, "entity"));
  const config = statisticsConfig[requestedEntity];

  if (!canReadEntity(config.entity, user)) {
    return { entity: requestedEntity, x: config.defaultX, y: config.defaultY, rows: [], total: 0 };
  }

  const x = allowedField(requestedEntity, getQuery(query, "x"), config.defaultX);
  const y = allowedField(requestedEntity, getQuery(query, "y"), config.defaultY);
  const filter = await buildEntityListFilter(config.entity, query, user);
  const needsStudentLookup = (requestedEntity === "sessions" || requestedEntity === "events") && (x.startsWith("student.") || y.startsWith("student."));

  const pipeline: Document[] = [{ $match: filter }];
  if (needsStudentLookup) {
    pipeline.push(
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
    );
  }

  pipeline.push(
    {
      $project: {
        xValue: expressionForField(x),
        yValue: expressionForField(y),
      },
    },
    {
      $group: {
        _id: { x: "$xValue", y: "$yValue" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.x": 1, "_id.y": 1 } },
    { $limit: 500 },
  );

  const rows = await getCollection(config.entity)
    .aggregate<{ _id: { x: unknown; y: unknown }; count: number }>(pipeline)
    .toArray();

  return {
    entity: requestedEntity,
    x,
    y,
    rows: rows.map((row) => ({ x: row._id.x, y: row._id.y, count: row.count })),
    total: rows.reduce((sum, row) => sum + row.count, 0),
  };
}
