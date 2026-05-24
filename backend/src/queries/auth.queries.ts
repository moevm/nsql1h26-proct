import type { Document, WithId } from "mongodb";

import { getCollection } from "../db/collections.js";

export function findUserByEmail(email: string | undefined): Promise<WithId<Document> | null> {
  return getCollection("users").findOne({ email });
}

export function countUsers(): Promise<number> {
  return getCollection("users").countDocuments();
}
