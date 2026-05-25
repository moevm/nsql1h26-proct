import { Router } from "express";
import type { Document } from "mongodb";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { canCreateEntity, canReadEntity, createEntity, getSessionById, listEntities, updateSessionById } from "../queries/entity.queries.js";
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

        const insertedId = await createEntity(entity, req.body as Document, user);
        res.status(201).json({ _id: insertedId });
      }),
    );
  }
}
