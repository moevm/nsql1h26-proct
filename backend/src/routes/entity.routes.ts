import { Router } from "express";
import type { Document } from "mongodb";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { createEntity, listEntities } from "../queries/entity.queries.js";
import { entityNames } from "../schema/entity.schema.js";
import { serializeDocument } from "../utils/query.js";

export const entityRouter = Router();

for (const entity of entityNames) {
  const path = `/${entity.replace("_", "-")}`;

  entityRouter.get(
    path,
    auth,
    asyncHandler(async (req, res) => {
      const { items, total, page, limit } = await listEntities(entity, req.query);
      res.json({ items: serializeDocument(items), total, page, limit });
    }),
  );

  if (entity !== "audit_logs") {
    entityRouter.post(
      path,
      auth,
      asyncHandler(async (req, res) => {
        const insertedId = await createEntity(entity, req.body as Document);
        res.status(201).json({ _id: insertedId });
      }),
    );
  }
}
