import { Router } from "express";
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
import { entityNames } from "../schema/entity.schema.js";
import type { AuthUser } from "../schema/user.schema.js";
import { serializeDocument } from "../utils/query.js";

export const entityRouter = Router();

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

        const userRecord = await updateUserById(String(req.params.id ?? ""), req.body as Document, user);
        if (!userRecord) {
          res.status(404).json({ message: "Пользователь не найден" });
          return;
        }

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

        const university = await updateUniversityById(String(req.params.id ?? ""), req.body as Document, user);
        if (!university) {
          res.status(404).json({ message: "Вуз не найден" });
          return;
        }

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

        const upload = await updateUploadById(String(req.params.id ?? ""), req.body as Document, user);
        if (!upload) {
          res.status(404).json({ message: "Загрузка не найдена" });
          return;
        }

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

        const session = await updateSessionById(String(req.params.id ?? ""), req.body as Document, user);
        if (!session) {
          res.status(404).json({ message: "Сессия не найдена" });
          return;
        }

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

        const student = await updateStudentById(String(req.params.id ?? ""), req.body as Document, user);
        if (!student) {
          res.status(404).json({ message: "Студент не найден" });
          return;
        }

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

        const event = await updateTimelineEventById(String(req.params.id ?? ""), req.body as Document, user);
        if (!event) {
          res.status(404).json({ message: "Событие не найдено" });
          return;
        }

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

        const run = await updateClusteringRunById(String(req.params.id ?? ""), req.body as Document, user);
        if (!run) {
          res.status(404).json({ message: "Запуск кластеризации не найден" });
          return;
        }

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
        res.status(201).json({ _id: insertedId });
      }),
    );
  }
}
