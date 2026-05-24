import { Router } from "express";

import { auth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/async-handler.js";
import type { AuthUser } from "../schema/user.schema.js";
import { login } from "../services/auth.service.js";

export const authRouter = Router();

authRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const result = await login(email, password);
    if (!result) {
      res.status(401).json({ message: "Неверный email или пароль" });
      return;
    }

    res.cookie("token", result.token, { httpOnly: true, sameSite: "lax" });
    res.json(result);
  }),
);

authRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

authRouter.get("/auth/me", auth, (_req, res) => {
  res.json({ user: res.locals.user as AuthUser });
});
