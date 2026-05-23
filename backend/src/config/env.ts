export const env = {
  PORT: Number(process.env.PORT ?? 8080),
  MONGO_URL: process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017",
  MONGO_DB: process.env.MONGO_DB ?? "proctoring",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-change-me",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173",
};
