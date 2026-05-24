import { connectDatabase, closeDatabase } from "../db/client.js";
import { ensureIndexes } from "../db/indexes.js";
import { seedLargeDemoData } from "../services/demo-data.service.js";

await connectDatabase();
await ensureIndexes();
const result = await seedLargeDemoData({ reset: true });
await closeDatabase();

console.log(`Seeded demo data: ${JSON.stringify(result)}`);
