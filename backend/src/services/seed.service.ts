import { countUsers } from "../queries/auth.queries.js";
import { seedLargeDemoData } from "./demo-data.service.js";

export async function seedDatabase() {
  const usersCount = await countUsers();
  if (usersCount > 0) return;

  await seedLargeDemoData();
}
