import type { Collection, Document } from "mongodb";

import { getDb } from "./client.js";
import { entityNames, type EntityName } from "../schema/entity.schema.js";

export function getCollection(name: EntityName): Collection<Document> {
  return getDb().collection(name);
}

export function getCollections(): Record<EntityName, Collection<Document>> {
  return Object.fromEntries(entityNames.map((name) => [name, getCollection(name)])) as Record<EntityName, Collection<Document>>;
}
