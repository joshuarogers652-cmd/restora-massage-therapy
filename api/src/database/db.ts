import { Pool, PoolClient, QueryResultRow } from "pg";
import { HttpError } from "../errors";

let pool: Pool | null = null;

export function dbConfigured() {
  return !!process.env.DATABASE_URL;
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "The database is not configured yet (DATABASE_URL).");
  }
  if (!pool) {
    const url = process.env.DATABASE_URL;
    const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
    pool = new Pool({
      connectionString: url,
      // Azure Database for PostgreSQL requires TLS.
      ssl: local || /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: true },
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function q<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], client?: PoolClient) {
  const res = await (client ?? getPool()).query<T>(sql, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], client?: PoolClient) {
  const rows = await q<T>(sql, params, client);
  return rows[0];
}

/**
 * Run work in a transaction. SERIALIZABLE transactions retry automatically on
 * serialization failures (40001) and deadlocks (40P01).
 */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>, opts: { serializable?: boolean; retries?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    const client = await getPool().connect();
    try {
      await client.query(opts.serializable ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      const code = (err as { code?: string }).code;
      if ((code === "40001" || code === "40P01") && attempt < retries) continue;
      throw err;
    } finally {
      client.release();
    }
  }
}

/** For tests and local tooling. */
export async function closePool() {
  if (pool) await pool.end();
  pool = null;
}
