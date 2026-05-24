import { Db, MongoClient } from "mongodb";

import { env } from "../config/env.js";

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectDatabase() {
  client = new MongoClient(env.MONGO_URL);

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await client.connect();
      break;
    } catch (error) {
      if (attempt === 20) throw error;
      console.log(`MongoDB is not ready yet, retry ${attempt}/20`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  db = client.db(env.MONGO_DB);
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("MongoDB connection has not been initialized");
  }
  return db;
}

export async function closeDatabase() {
  await client?.close();
  client = undefined;
  db = undefined;
}
