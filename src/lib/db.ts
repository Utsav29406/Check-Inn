import "server-only";
import { Pool, types, type PoolClient } from "pg";

// Return DATE / TIMESTAMPTZ as strings and NUMERIC / BIGINT as numbers (ids, ratings, SUMs).
types.setTypeParser(1082, (v) => v); // date
types.setTypeParser(1184, (v) => v); // timestamptz
types.setTypeParser(1700, (v) => parseFloat(v)); // numeric
types.setTypeParser(20, (v) => parseInt(v, 10)); // int8

const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add your PostgreSQL connection string.");
  }
  // pg already treats sslmode=require as verify-full but logs a warning on every connection; say verify-full directly.
  const connectionString = process.env.DATABASE_URL.replace(/sslmode=(prefer|require|verify-ca)\b/, "sslmode=verify-full");
  return new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

/** Lazily created so `next build` works without database credentials. */
export function db(): Pool {
  if (!globalForDb.pgPool) globalForDb.pgPool = createPool();
  return globalForDb.pgPool;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await db().query(sql, params);
  return rows as T[];
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
