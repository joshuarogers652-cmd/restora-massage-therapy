import fs from "node:fs";
import path from "node:path";
import { getPool } from "./db";

/**
 * Applies SQL files in api/database/migrations that haven't run yet.
 * Runs once per cold start, guarded by a Postgres advisory lock so parallel
 * instances never apply the same migration twice.
 */
let done: Promise<void> | null = null;
let lastError: string | null = null;

export function migrationsDir() {
  // dist/src/database → api/database/migrations (and src/database when run with tsx)
  const candidates = [
    path.resolve(__dirname, "../../../database/migrations"),
    path.resolve(__dirname, "../../database/migrations"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0]!;
}

export function migrationState() {
  return { error: lastError };
}

export function ensureMigrated(): Promise<void> {
  if (!done) {
    done = run().catch((err) => {
      done = null; // try again on the next request
      lastError = (err as Error).message;
      throw err;
    });
  }
  return done;
}

async function run() {
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock(72017001)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
    const files = fs.readdirSync(migrationsDir()).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir(), file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
    lastError = null;
  } finally {
    await client.query("SELECT pg_advisory_unlock(72017001)").catch(() => undefined);
    client.release();
  }
}
