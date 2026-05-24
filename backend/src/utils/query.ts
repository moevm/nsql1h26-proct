import type { Request } from "express";
import { Document, ObjectId } from "mongodb";

export type QuerySource = Request["query"] | Record<string, unknown>;

export function getQuery(source: QuerySource, key: string): string | undefined {
  const value = source[key];
  if (Array.isArray(value)) return String(value[0]);
  if (value === undefined) return undefined;
  return String(value);
}

export function setNested(target: Document, path: string, value: unknown) {
  const parts = path.split(".");
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    cursor[part] = (cursor[part] as Document) ?? {};
    cursor = cursor[part] as Document;
  }
  cursor[parts[parts.length - 1]] = value;
}

export function normalizeIncoming(body: Document): Document {
  const next: Document = { ...body };
  for (const key of ["_id", "id"]) delete next[key];
  for (const [key, value] of Object.entries(next)) {
    if (key.endsWith("Id") && typeof value === "string" && ObjectId.isValid(value)) {
      next[key] = new ObjectId(value);
    }
  }
  return next;
}

export function serializeDocument<T extends Document | Document[]>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}
