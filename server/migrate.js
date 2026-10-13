import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { logger } from "./logger.js";
const here = path.dirname(fileURLToPath(import.meta.url));
/** The database may still be starting (`npm run dev` boots everything at once): retry a few times. */
export async function waitForDb(attempts = 40, delayMs = 750) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      if (i === attempts) throw err;
      if (i === 1) logger.warn("Waiting for the database to accept connections ...");
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
export async function migrate() {
  const sql = fs.readFileSync(path.resolve(here, "../db/schema.sql"), "utf8");
  await pool.query(sql);
}
