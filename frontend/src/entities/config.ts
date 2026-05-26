import { createElement } from "react";
import { Link } from "react-router-dom";
import { EntityConfig } from "./types";

const dateTimeFilters = (field: string, label: string) => ({ key: field, label, type: "dateTime" as const });
const numberFilters = (field: string, label: string) => ({ key: field, label, type: "numberRange" as const });
const textFilter = (field: string, label: string) => ({ key: field, label, type: "text" as const });



export const entityConfigs: Record<string, EntityConfig> = {
  users: {
    title: "Пользователи",
    endpoint: "/users",
    detailTitleKey: "fullName",
    detailBackPath: "/users",
    detailEditable: true,
    columns: [
      { key: "fullName", label: "ФИО" },
      { key: "email", label: "Email" },
      { key: "role", label: "Роль" },
      { key: "createdAt", label: "Дата/время создания" },
    ],
    filters: [
      textFilter("fullName", "ФИО"),
      textFilter("email", "Email"),
      { key: "role", label: "Роль", type: "select", options: ["admin", "teacher"] },
      dateTimeFilters("createdAt", "Дата/время создания"),
    ],
    createTemplate: { email: "", password: "", fullName: "", role: "teacher" },
  },
  universities: {
    title: "Вузы",
    endpoint: "/universities",
    columns: [
      { key: "name", label: "Название" },
      { key: "shortName", label: "Кратко" },
      { key: "externalCode", label: "Код" },
    ],
    filters: [textFilter("name", "Название"), textFilter("shortName", "Кратко"), textFilter("externalCode", "Код")],
    createTemplate: { name: "", shortName: "", externalCode: "" },
  },
  uploads: {
    title: "История загрузок",
    endpoint: "/uploads",
    columns: [
      { key: "_id", label: "ID" },
      { key: "importBatchId", label: "Пачка" },
      { key: "status", label: "Статус" },
      { key: "filesCount", label: "Файлов" },
      { key: "totalRows", label: "Строк" },
      { key: "matchedStudents", label: "Студентов" },
      { key: "createdAt", label: "Создана" },
    ],
    filters: [
      { key: "status", label: "Статус", type: "select", options: ["pending", "processing", "done", "done_with_warnings", "error"] },
      textFilter("importBatchId", "ID пачки"),
      dateTimeFilters("createdAt", "Дата создания"),
      numberFilters("filesCount", "Количество файлов"),
      numberFilters("totalRows", "Количество строк"),
      numberFilters("matchedStudents", "Сопоставлено студентов"),
    ],
    createTemplate: {},
  },
  students: {
    title: "Студенты",
    endpoint: "/students",
    detailTitleKey: "fullName",
    detailBackPath: "/students",
    detailAdditionalNodes: (record) =>
      record._id
        ? createElement(
            Link,
            { className: "button button_secondary", to: `/sessions?studentId=${record._id}` },
            "Сессии студента",
          )
        : null,
    columns: [
      { key: "fullName", label: "ФИО" },
      { key: "externalId", label: "Внешний ID" },
      { key: "recordBookNumber", label: "Зачётка" },
      { key: "email", label: "Email" },
      { key: "program", label: "Программа" },
      { key: "educationLevel", label: "Уровень" },
      { key: "group", label: "Группа" },
      { key: "createdAt", label: "Дата/время регистрации" },
      { key: "sessionCount", label: "Сессий" },
    ],
    filters: [
      textFilter("fullName", "ФИО"),
      textFilter("externalId", "Внешний ID"),
      textFilter("recordBookNumber", "Зачётка"),
      textFilter("email", "Email"),
      textFilter("faculty", "Факультет"),
      textFilter("program", "Программа"),
      { key: "educationLevel", label: "Уровень обучения", type: "select", options: ["bachelor", "master", "specialist"] },
      textFilter("group", "Группа"),
      dateTimeFilters("createdAt", "Дата/время регистрации"),
      numberFilters("sessionCount", "Количество сессий"),
    ],
    createTemplate: {
      externalId: "",
      recordBookNumber: "",
      fullName: "",
      email: "",
      faculty: "",
      program: "",
      educationLevel: "bachelor",
      group: "",
      faceEmbedding: [],
    },
  },
  events: {
    title: "Таймлайн событий",
    endpoint: "/timeline-events",
    detailTitleKey: "eventType",
    detailBackPath: "/events",
    detailEditable: true,
    detailAdditionalNodes: (record) =>
      record.sessionId
        ? createElement(
            Link,
            { className: "button button_secondary", to: `/sessions/${record.sessionId}` },
            "Сессия",
          )
        : null,
    columns: [
      { key: "eventType", label: "Тип" },
      { key: "eventTime", label: "Время" },
      { key: "sourceFileKey", label: "Файл" },
      { key: "moodle.action", label: "Действие Moodle" },
      { key: "moodle.courseName", label: "Имя курса" },
      { key: "moodle.target", label: "Цель Moodle" },
      { key: "student.group", label: "Группа студента" },
      { key: "student.program", label: "Программа студента" },
      { key: "student.educationLevel", label: "Уровень обучения" },
      { key: "moodle.timeSpent", label: "Время на вопрос" },
    ],
    filters: [
      { key: "eventType", label: "Тип события", type: "select", options: ["moodle", "ocr_frame", "system"] },
      dateTimeFilters("eventTime", "Время события"),
      textFilter("sourceFileKey", "Файл"),
      textFilter("moodle.action", "Действие Moodle"),
      textFilter("moodle.courseName", "Имя курса"),
      textFilter("moodle.target", "Цель Moodle"),
      textFilter("student.group", "Группа студента"),
      textFilter("student.program", "Программа студента"),
      { key: "student.educationLevel", label: "Уровень обучения", type: "select", options: ["bachelor", "master", "specialist"] },
      numberFilters("moodle.timeSpent", "Время на вопрос"),
    ],
    createTemplate: { eventType: "system", eventTime: "", system: { code: "", message: "" } },
  },
  sessions: {
    title: "Сессии",
    endpoint: "/sessions",
    detailTitleKey: "examName",
    detailBackPath: "/sessions",
    detailEditable: true,
    detailAdditionalNodes: (record) =>
      record._id
        ? createElement(
            Link,
            { className: "button button_secondary", to: `/events?sessionId=${record._id}` },
            "События сессии",
          )
        : null,
    columns: [
      { key: "examName", label: "Экзамен" },
      { key: "courseName", label: "Имя курса" },
      { key: "student.group", label: "Группа студента" },
      { key: "student.program", label: "Программа студента" },
      { key: "student.educationLevel", label: "Уровень обучения" },
      { key: "startTime", label: "Начало" },
      { key: "durationMinutes", label: "Длительность" },
      { key: "metrics.combined.riskLevel", label: "Риск" },
      { key: "metrics.combined.anomalyScore", label: "Аномальность" },
    ],
    filters: [
      textFilter("examName", "Экзамен"),
      textFilter("courseName", "Имя курса"),
      textFilter("student.group", "Группа студента"),
      textFilter("student.program", "Программа студента"),
      { key: "student.educationLevel", label: "Уровень обучения", type: "select", options: ["bachelor", "master", "specialist"] },
      { key: "metrics.combined.riskLevel", label: "Риск", type: "select", options: ["low", "medium", "high"] },
      dateTimeFilters("startTime", "Начало"),
      numberFilters("durationMinutes", "Длительность"),
      numberFilters("metrics.combined.anomalyScore", "Балл аномальности"),
    ],
    createTemplate: {
      examName: "",
      startTime: "",
      endTime: "",
      durationMinutes: 0,
      metrics: {},
      featureVector: [],
    },
  },
  runs: {
    title: "История запусков кластеризации",
    endpoint: "/clustering-runs",
    columns: [
      { key: "_id", label: "ID" },
      { key: "algorithm", label: "Алгоритм" },
      { key: "status", label: "Статус" },
      { key: "results.totalSessions", label: "Сессий" },
      { key: "results.clusterCount", label: "Кластеров" },
      { key: "results.anomalyCount", label: "Аномалий" },
    ],
    filters: [
      { key: "algorithm", label: "Алгоритм", type: "select", options: ["kmeans", "dbscan"] },
      { key: "status", label: "Статус", type: "select", options: ["running", "done", "error"] },
      dateTimeFilters("startedAt", "Начало"),
      numberFilters("results.totalSessions", "Количество сессий"),
      numberFilters("results.anomalyCount", "Количество аномалий"),
    ],
    createTemplate: { algorithm: "kmeans", status: "done", parameters: {}, results: {} },
  },
  audit: {
    title: "Аудит действий",
    endpoint: "/audit-logs",
    detailTitleKey: "action",
    detailBackPath: "/audit",
    columns: [
      { key: "actorType", label: "Субъект" },
      { key: "action", label: "Действие" },
      { key: "entityType", label: "Сущность" },
      { key: "occurredAt", label: "Время" },
    ],
    filters: [
      { key: "actorType", label: "Тип субъекта", type: "select", options: ["user", "system"] },
      textFilter("action", "Действие"),
      textFilter("entityType", "Сущность"),
      dateTimeFilters("occurredAt", "Время"),
    ],
    createTemplate: {},
  },
};
