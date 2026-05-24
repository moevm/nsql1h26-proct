import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/client.js";
import { ensureIndexes } from "./db/indexes.js";
import { seedDatabase } from "./services/seed.service.js";

await connectDatabase();
await ensureIndexes();
await seedDatabase();

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Backend is running on http://127.0.0.1:${env.PORT}`);
});
