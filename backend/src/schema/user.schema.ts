import type { ObjectId } from "mongodb";

export type Role = "admin" | "teacher";

export type AuthUser = {
  _id: string;
  email: string;
  fullName: string;
  role: Role;
};

export type UserDocument = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  createdAt: Date;
  updateTime: Date;
};
