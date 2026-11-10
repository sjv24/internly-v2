import pg from "pg";
import { config } from "./config.js";

// A pool keeps several connections open and hands one to each request, so one slow
// query does not block everybody (v1 used a single shared connection).
export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

// DATE columns come back as plain "YYYY-MM-DD" strings instead of JS Date objects
// (avoids timezone shifts when they cross the JSON boundary).
pg.types.setTypeParser(1082, (v: string) => v);

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/** Run several queries atomically: either all succeed or none are applied. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
