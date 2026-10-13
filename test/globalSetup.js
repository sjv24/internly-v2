import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
/** Runs once before all tests: give them a clean schema in the TEST database (never the dev one). */
export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!/_test\b/.test(url)) throw new Error(`Refusing to run tests against a non-test database: ${url}`);
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (err) {
    throw new Error("Cannot reach the test database. Is it running? (npm run db)", { cause: err });
  }
  const schema = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../db/schema.sql"),
    "utf8",
  );
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.query(schema);
  await client.end();
}
