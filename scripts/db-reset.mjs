// `npm run db:reset` - wipes every table in the local database (the dev database must be running).
// On the next API start the schema is recreated and demo data is loaded again.
import dotenv from "dotenv";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (run `npm run setup` first)");
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("Refusing to reset a non-local database.");

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await client.end();
console.log("Database wiped. Restart the API (or `npm run dev`) to recreate tables and demo data.");
