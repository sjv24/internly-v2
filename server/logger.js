import { config } from "./config.js";

/**
 * A tiny structured logger: one JSON object per line, which is what log tools (Datadog, CloudWatch,
 * grep + jq) expect. Usage: logger.info({ reqId, userId }, "listing created")
 */
function write(level, first, second) {
  if (config.isTest) return;
  const [fields, msg] = typeof first === "string" ? [{}, first] : [first, second];
  const line = { level, time: new Date().toISOString(), msg, ...fields };
  if (fields?.err instanceof Error) line.err = { message: fields.err.message, stack: fields.err.stack };
  (level === "error" ? console.error : console.log)(JSON.stringify(line));
}

export const logger = {
  info: (a, b) => write("info", a, b),
  warn: (a, b) => write("warn", a, b),
  error: (a, b) => write("error", a, b),
};
