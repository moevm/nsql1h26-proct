import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/client.js";
import { ensureIndexes } from "./db/indexes.js";
import { seedDatabase } from "./services/seed.service.js";
import fs from "node:fs/promises";

await connectDatabase();
await ensureIndexes();
await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
await seedDatabase();

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Backend is running on http://127.0.0.1:${env.PORT}`);
});
