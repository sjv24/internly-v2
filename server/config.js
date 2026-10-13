import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load <project root>/.env (variables already set, e.g. on a hosting platform, win over the file)
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env"), quiet: true });

// Validate the environment once at startup, so a typo fails immediately and loudly,
// not later in the middle of a request.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_ORIGIN: z.string().default("http://localhost:3000"),
  SEED_ON_EMPTY: z.string().default("false"),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("claude-opus-5-5"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.issues.map((i) => `${i.path}: ${i.message}`),
  );
  process.exit(1);
}
const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  // origins allowed to send state-changing requests (CSRF check)
  allowedOrigins: env.APP_ORIGIN.split(",").map((s) => s.trim()),
  seedOnEmpty: env.SEED_ON_EMPTY === "true",
  ai: { apiKey: env.AI_API_KEY, model: env.AI_MODEL },
  uploadDir: path.resolve(here, "../uploads"),
  publicDir: path.resolve(here, "../public"),
  sessionDays: 7,
  cookieName: "sid",
};
