import { Router } from "express";

import { authRouter } from "./auth.routes.js";
import { backupRouter } from "./backup.routes.js";
import { clusteringRouter } from "./clustering.routes.js";
import { entityRouter } from "./entity.routes.js";
import { healthRouter } from "./health.routes.js";
import { reportsRouter } from "./reports.routes.js";
import { uploadsRouter } from "./uploads.routes.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(entityRouter);
apiRouter.use(uploadsRouter);
apiRouter.use(clusteringRouter);
apiRouter.use(reportsRouter);
apiRouter.use(backupRouter);
