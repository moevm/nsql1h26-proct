import type { Collection, Document } from "mongodb";

import { getDb } from "./client.js";
import { entityNames, type EntityName } from "../schema/entity.schema.js";

export function getCollection(name: EntityName): Collection<Document> {
  return getDb().collection(name);
}

export function getInternalCollection<TSchema extends Document = Document>(name: string): Collection<TSchema> {
  return getDb().collection<TSchema>(name);
}

export function getBackupHistoryCollection<TSchema extends Document = Document>(): Collection<TSchema> {
  return getInternalCollection<TSchema>("backup_history");
}

export function getCollections(): Record<EntityName, Collection<Document>> {
  return Object.fromEntries(entityNames.map((name) => [name, getCollection(name)])) as Record<EntityName, Collection<Document>>;
}
