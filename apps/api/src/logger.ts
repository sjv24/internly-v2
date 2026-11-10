import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.isTest ? "silent" : "info",
  // human-readable logs in dev; plain JSON in production (what log tools expect)
  transport: config.env === "development" ? { target: "pino-pretty", options: { singleLine: true } } : undefined,
});
