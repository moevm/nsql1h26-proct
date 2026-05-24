import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Document, WithId } from "mongodb";

import { env } from "../config/env.js";
import { findUserByEmail } from "../queries/auth.queries.js";
import type { AuthUser, Role } from "../schema/user.schema.js";

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: "12h" });
}

export function userPublic(user: WithId<Document>): AuthUser {
  return {
    _id: user._id.toString(),
    email: String(user.email),
    fullName: String(user.fullName),
    role: user.role as Role,
  };
}

export async function login(email: string | undefined, password: string | undefined) {
  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password ?? "", String(user.passwordHash)))) {
    return null;
  }

  const publicUser = userPublic(user);
  return {
    token: signToken(publicUser),
    user: publicUser,
  };
}
