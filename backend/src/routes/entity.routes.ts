import { Router, type Response } from "express";
import type { Document } from "mongodb";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import {
  canCreateEntity,
  canReadEntity,
  createEntity,
  getAuditLogById,
  getClusteringRunById,
  getSessionById,
  getStudentById,
  getTimelineEventById,
  getUniversityById,
  getUploadById,
  getUserById,
  listEntities,
  updateClusteringRunById,
  updateSessionById,
  updateStudentById,
  updateTimelineEventById,
  updateUniversityById,
  updateUploadById,
  updateUserById,
} from "../queries/entity.queries.js";
import { entityNames, type EntityName } from "../schema/entity.schema.js";
import type { AuthUser } from "../schema/user.schema.js";
import { changedFields, recordRequestAuditEvent } from "../services/audit.service.js";
import { serializeDocument } from "../utils/query.js";

export const entityRouter = Router();

const readOnlyUpdateFields: Partial<Record<EntityName, string[]>> = {
  users: ["passwordHash"],
  students: ["sessionCount"],
  sessions: ["student", "courseName"],
  timeline_events: ["student"],
  uploads: ["createdByName"],
};
const immutableUpdateFields = ["_id", "id"];

function normalizeComparable(value: unknown): unknown {
  if (value === undefined) return undefined;
  const serialized = JSON.parse(JSON.stringify(value)) as unknown;
  if (Array.isArray(serialized)) return serialized.map(normalizeComparable);
  if (!serialized || typeof serialized !== "object") return serialized;

  return Object.fromEntries(
    Object.entries(serialized as Document)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, normalizeComparable(nestedValue)]),
  );
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(normalizeComparable(left)) === JSON.stringify(normalizeComparable(right));
}

function rejectReadOnlyUpdateFields(res: Response, entity: EntityName, body: Document, before: Document | null) {
  if (!before) return false;
  const fields = [...immutableUpdateFields, ...(readOnlyUpdateFields[entity] ?? [])].filter((field) => Object.hasOwn(body, field) && !sameValue(body[field], before?.[field]));
  if (!fields.length) return false;

  res.status(400).json({
    message: `Поле ${fields.join(", ")} не является редактируемым полем этой сущности`,
    fields,
  });
  return true;
}

async function getEntityRecordById(entity: EntityName, id: string, user: AuthUser) {
  if (entity === "users") return getUserById(id, user);
  if (entity === "universities") return getUniversityById(id, user);
  if (entity === "uploads") return getUploadById(id, user);
  if (entity === "students") return getStudentById(id, user);
  if (entity === "sessions") return getSessionById(id, user);
  if (entity === "timeline_events") return getTimelineEventById(id, user);
  if (entity === "clustering_runs") return getClusteringRunById(id, user);
  if (entity === "audit_logs") return getAuditLogById(id, user);
  return null;
}

function auditEntityType(entity: EntityName) {
  return entity === "users" ? "user" : entity;
}

async function recordEntityUpdateAudit(req: Parameters<typeof recordRequestAuditEvent>[0], user: AuthUser, entity: EntityName, id: string, before: Document | null, after: Document, body: Document) {
  const fields = changedFields(before, after).filter((field) => !["updateTime"].includes(field));
  await recordRequestAuditEvent(req, user, {
    action: entity === "users" ? "user.update" : "entity.update",
    entityType: auditEntityType(entity),
    entityId: id,
    before,
    after,
    details: {
      fields,
      ...(entity === "users" ? { passwordChanged: typeof body.password === "string" && Boolean(body.password.trim()), roleChanged: before?.role !== after.role } : {}),
    },
  });
}

async function recordEntityCreateAudit(req: Parameters<typeof recordRequestAuditEvent>[0], user: AuthUser, entity: EntityName, id: string, body: Document, after: Document | null) {
  await recordRequestAuditEvent(req, user, {
    action: entity === "users" ? "user.create" : "entity.create",
    entityType: auditEntityType(entity),
    entityId: id,
    before: null,
    after,
    details: {
      fields: Object.keys(body).filter((field) => field !== "password"),
      ...(entity === "users" ? { passwordSet: typeof body.password === "string" && Boolean(body.password.trim()), role: after?.role ?? body.role } : {}),
    },
  });
}

for (const entity of entityNames) {
  const path = `/${entity.replace("_", "-")}`;

  entityRouter.get(
    path,
    auth,
    asyncHandler(async (req, res) => {
      const user = res.locals.user as AuthUser;
      if (!canReadEntity(entity, user)) {
        res.status(403).json({ message: "Недостаточно прав" });
        return;
      }

      const { items, total, page, limit } = await listEntities(entity, req.query, user);
      res.json({ items: serializeDocument(items), total, page, limit });
    }),
  );

  if (entity === "users") {
    entityRouter.get(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canReadEntity("users", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const userRecord = await getUserById(String(req.params.id ?? ""), user);
        if (!userRecord) {
          res.status(404).json({ message: "Пользователь не найден" });
          return;
        }

        res.json(serializeDocument(userRecord));
      }),
    );

    entityRouter.patch(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canCreateEntity("users", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const id = String(req.params.id ?? "");
        const before = await getUserById(id, user);
        const body = req.body as Document;
        if (rejectReadOnlyUpdateFields(res, "users", body, before)) return;
        const userRecord = await updateUserById(id, body, user);
        if (!userRecord) {
          res.status(404).json({ message: "Пользователь не найден" });
          return;
        }

        await recordEntityUpdateAudit(req, user, "users", id, before, userRecord, body);
        res.json(serializeDocument(userRecord));
      }),
    );
  }

  if (entity === "universities") {
    entityRouter.get(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canReadEntity("universities", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const university = await getUniversityById(String(req.params.id ?? ""), user);
        if (!university) {
          res.status(404).json({ message: "Вуз не найден" });
          return;
        }

        res.json(serializeDocument(university));
      }),
    );

    entityRouter.patch(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canCreateEntity("universities", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const id = String(req.params.id ?? "");
        const before = await getUniversityById(id, user);
        const body = req.body as Document;
        if (rejectReadOnlyUpdateFields(res, "universities", body, before)) return;
        const university = await updateUniversityById(id, body, user);
        if (!university) {
          res.status(404).json({ message: "Вуз не найден" });
          return;
        }

        await recordEntityUpdateAudit(req, user, "universities", id, before, university, body);
        res.json(serializeDocument(university));
      }),
    );
  }

  if (entity === "uploads") {
    entityRouter.get(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canReadEntity("uploads", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const upload = await getUploadById(String(req.params.id ?? ""), user);
        if (!upload) {
          res.status(404).json({ message: "Загрузка не найдена" });
          return;
        }

        res.json(serializeDocument(upload));
      }),
    );

    entityRouter.patch(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canCreateEntity("uploads", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const id = String(req.params.id ?? "");
        const before = await getUploadById(id, user);
        const body = req.body as Document;
        if (rejectReadOnlyUpdateFields(res, "uploads", body, before)) return;
        const upload = await updateUploadById(id, body, user);
        if (!upload) {
          res.status(404).json({ message: "Загрузка не найдена" });
          return;
        }

        await recordEntityUpdateAudit(req, user, "uploads", id, before, upload, body);
        res.json(serializeDocument(upload));
      }),
    );
  }

  if (entity === "audit_logs") {
    entityRouter.get(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canReadEntity("audit_logs", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const auditLog = await getAuditLogById(String(req.params.id ?? ""), user);
        if (!auditLog) {
          res.status(404).json({ message: "Запись аудита не найдена" });
          return;
        }

        res.json(serializeDocument(auditLog));
      }),
    );
  }

  if (entity === "sessions") {
    entityRouter.get(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canReadEntity("sessions", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const session = await getSessionById(String(req.params.id ?? ""), user);
        if (!session) {
          res.status(404).json({ message: "Сессия не найдена" });
          return;
        }

        res.json(serializeDocument(session));
      }),
    );

    entityRouter.patch(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canCreateEntity("sessions", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const id = String(req.params.id ?? "");
        const before = await getSessionById(id, user);
        const body = req.body as Document;
        if (rejectReadOnlyUpdateFields(res, "sessions", body, before)) return;
        const session = await updateSessionById(id, body, user);
        if (!session) {
          res.status(404).json({ message: "Сессия не найдена" });
          return;
        }

        await recordEntityUpdateAudit(req, user, "sessions", id, before, session, body);
        res.json(serializeDocument(session));
      }),
    );
  }

  if (entity === "students") {
    entityRouter.get(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canReadEntity("students", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const student = await getStudentById(String(req.params.id ?? ""), user);
        if (!student) {
          res.status(404).json({ message: "Студент не найден" });
          return;
        }

        res.json(serializeDocument(student));
      }),
    );

    entityRouter.patch(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canCreateEntity("students", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const id = String(req.params.id ?? "");
        const before = await getStudentById(id, user);
        const body = req.body as Document;
        if (rejectReadOnlyUpdateFields(res, "students", body, before)) return;
        const student = await updateStudentById(id, body, user);
        if (!student) {
          res.status(404).json({ message: "Студент не найден" });
          return;
        }

        await recordEntityUpdateAudit(req, user, "students", id, before, student, body);
        res.json(serializeDocument(student));
      }),
    );
  }

  if (entity === "timeline_events") {
    entityRouter.get(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canReadEntity("timeline_events", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const event = await getTimelineEventById(String(req.params.id ?? ""), user);
        if (!event) {
          res.status(404).json({ message: "Событие не найдено" });
          return;
        }

        res.json(serializeDocument(event));
      }),
    );

    entityRouter.patch(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canCreateEntity("timeline_events", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const id = String(req.params.id ?? "");
        const before = await getTimelineEventById(id, user);
        const body = req.body as Document;
        if (rejectReadOnlyUpdateFields(res, "timeline_events", body, before)) return;
        const event = await updateTimelineEventById(id, body, user);
        if (!event) {
          res.status(404).json({ message: "Событие не найдено" });
          return;
        }

        await recordEntityUpdateAudit(req, user, "timeline_events", id, before, event, body);
        res.json(serializeDocument(event));
      }),
    );
  }

  if (entity === "clustering_runs") {
    entityRouter.get(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canReadEntity("clustering_runs", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const run = await getClusteringRunById(String(req.params.id ?? ""), user);
        if (!run) {
          res.status(404).json({ message: "Запуск кластеризации не найден" });
          return;
        }

        res.json(serializeDocument(run));
      }),
    );

    entityRouter.patch(
      `${path}/:id`,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canCreateEntity("clustering_runs", user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const id = String(req.params.id ?? "");
        const before = await getClusteringRunById(id, user);
        const body = req.body as Document;
        if (rejectReadOnlyUpdateFields(res, "clustering_runs", body, before)) return;
        const run = await updateClusteringRunById(id, body, user);
        if (!run) {
          res.status(404).json({ message: "Запуск кластеризации не найден" });
          return;
        }

        await recordEntityUpdateAudit(req, user, "clustering_runs", id, before, run, body);
        res.json(serializeDocument(run));
      }),
    );
  }

  if (entity !== "audit_logs") {
    entityRouter.post(
      path,
      auth,
      asyncHandler(async (req, res) => {
        const user = res.locals.user as AuthUser;
        if (!canCreateEntity(entity, user)) {
          res.status(403).json({ message: "Недостаточно прав" });
          return;
        }

        const body = req.body as Document;
        if (entity === "users" && (typeof body.password !== "string" || !body.password.trim())) {
          res.status(400).json({ message: "Пароль обязателен" });
          return;
        }

        const insertedId = await createEntity(entity, body, user);
        const id = String(insertedId);
        const created = await getEntityRecordById(entity, id, user);
        await recordEntityCreateAudit(req, user, entity, id, body, created);
        res.status(201).json({ _id: insertedId });
      }),
    );
  }
}
