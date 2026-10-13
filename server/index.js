import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { purgeExpiredSessions } from "./lib/sessions.js";
import { logger } from "./logger.js";
import { migrate, waitForDb } from "./migrate.js";
import { seedIfEmpty } from "./seed.js";
await waitForDb();
await migrate();
await purgeExpiredSessions();
if (config.seedOnEmpty && (await seedIfEmpty())) logger.info("empty database: loaded demo data");
const app = createApp();
const server = app.listen(config.port, () => {
  logger.info(`API listening on http://localhost:${config.port}  (${config.env})`);
});
// Graceful shutdown: stop accepting requests, let in-flight ones finish, close DB connections.
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
