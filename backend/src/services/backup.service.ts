import type { Document } from "mongodb";

import { exportCollections, importCollections } from "../queries/backup.queries.js";
import type { EntityName } from "../schema/entity.schema.js";

export function exportBackup() {
  return exportCollections();
}

export async function importBackup(payload: Partial<Record<EntityName, Document[]>>) {
  await importCollections(payload);
  return { ok: true };
}
