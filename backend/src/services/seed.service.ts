import { getCollection } from "../db/collections.js";
import { entityNames } from "../schema/entity.schema.js";
import { seedLargeDemoData } from "./demo-data.service.js";

async function isDatabaseEmpty() {
  const counts = await Promise.all(entityNames.map((entity) => getCollection(entity).estimatedDocumentCount()));
  return counts.every((count) => count === 0);
}

export async function seedDatabase() {
  if (!(await isDatabaseEmpty())) return;

  await seedLargeDemoData();
}
