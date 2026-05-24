import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import type { AuthUser } from "../schema/user.schema.js";

function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return req.cookies?.token as string | undefined;
}

export async function auth(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ message: "Необходима авторизация" });
    return;
  }

  try {
    res.locals.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    next();
  } catch {
    res.status(401).json({ message: "Сессия недействительна" });
  }
}
