// Starts a real PostgreSQL server for local development - no Docker, no installer.
// The binaries come from the `embedded-postgres` npm package; data lives in ./.pgdata
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".pgdata");
const PORT = Number(process.env.PGPORT ?? 54330);
const DB_NAMES = ["internly_vanilla", "internly_vanilla_test"];

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  onLog: () => {}, // keep the console quiet; set to console.log to debug
  onError: (e) => console.error("[postgres]", e),
});

const firstRun = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
if (firstRun) {
  console.log("[db] first run: initialising a new database cluster in .pgdata ...");
  await pg.initialise();
}
await pg.start();
for (const name of DB_NAMES) {
  try {
    await pg.createDatabase(name);
    console.log(`[db] created database "${name}"`);
  } catch {
    /* already exists */
  }
}
console.log(`[db] PostgreSQL ready on port ${PORT}`);
console.log(`[db] DATABASE_URL=postgres://postgres:postgres@localhost:${PORT}/internly_vanilla`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  console.log("\n[db] stopping PostgreSQL ...");
  try {
    await pg.stop();
  } catch {
    /* already stopped */
  }
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// keep the process alive
setInterval(() => {}, 1 << 30);
