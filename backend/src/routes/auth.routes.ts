import { Router } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { auth, readToken } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { AuthUser } from "../schema/user.schema.js";
import { recordRequestAuditEvent } from "../services/audit.service.js";
import { login } from "../services/auth.service.js";

export const authRouter = Router();

function readLogoutUser(req: Parameters<typeof readToken>[0]) {
  const token = readToken(req);
  if (!token) return undefined;

  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthUser;
  } catch {
    return undefined;
  }
}

authRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const result = await login(email, password);
    if (!result) {
      await recordRequestAuditEvent(req, undefined, {
        action: "auth.login_failure",
        entityType: "auth",
        details: { email: email ?? "" },
      });
      res.status(401).json({ message: "Неверный email или пароль" });
      return;
    }

    await recordRequestAuditEvent(req, result.user, {
      action: "auth.login_success",
      entityType: "user",
      entityId: result.user._id,
      details: { email: result.user.email, role: result.user.role },
    });

    res.cookie("token", result.token, { httpOnly: true, sameSite: "lax" });
    res.json(result);
  }),
);

authRouter.post("/auth/logout", asyncHandler(async (req, res) => {
  const user = readLogoutUser(req);
  await recordRequestAuditEvent(req, user, {
    action: "auth.logout",
    entityType: user ? "user" : "auth",
    entityId: user?._id,
  });
  res.clearCookie("token");
  res.json({ ok: true });
}));

authRouter.get("/auth/me", auth, (_req, res) => {
  res.json({ user: res.locals.user as AuthUser });
});
