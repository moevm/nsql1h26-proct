import type { Document } from "mongodb";

import { getCollection } from "../db/collections.js";
import { entityNames, type EntityName } from "../schema/entity.schema.js";

export async function exportCollections() {
  const data: Record<string, Document[]> = {};
  for (const name of entityNames) {
    data[name] = await getCollection(name).find({}).toArray();
  }
  return data;
}

export async function importCollections(payload: Partial<Record<EntityName, Document[]>>) {
  for (const name of Object.keys(payload) as EntityName[]) {
    if (!entityNames.includes(name) || !Array.isArray(payload[name])) continue;
    await getCollection(name).deleteMany({});
    if (payload[name]!.length) await getCollection(name).insertMany(payload[name]!);
  }
}
