import { Router } from "express";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { getStatistics } from "../queries/statistics.queries.js";
import type { AuthUser } from "../schema/user.schema.js";

export const statisticsRouter = Router();

statisticsRouter.get(
  "/statistics",
  auth,
  asyncHandler(async (req, res) => {
    const user = res.locals.user as AuthUser;
    res.json(await getStatistics(req.query, user));
  }),
);
