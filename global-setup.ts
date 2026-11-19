/**
 * Starts a throwaway PostgreSQL database for the API tests.
 * - If TEST_DATABASE_URL is set (a server you control), a fresh database is created on it.
 * - Otherwise an embedded PostgreSQL server is downloaded from npm and started (not as root).
 * Test data is fictional and the database is deleted afterwards.
 */
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import pg from "pg";

let stop: (() => Promise<void>) | null = null;

export default async function setup() {
  let serverUrl = process.env.TEST_DATABASE_URL;
  if (!serverUrl) {
    if (process.getuid?.() === 0) throw new Error("Embedded PostgreSQL can't run as root. Set TEST_DATABASE_URL to a PostgreSQL server instead.");
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "restora-pg-"));
    const port = 55000 + Math.floor(Math.random() * 5000);
    const server = new EmbeddedPostgres({ databaseDir: dir, port, user: "postgres", password: "test", persistent: false, initdbFlags: ["--locale=C", "--lc-messages=C", "--encoding=UTF8"] });
    await server.initialise();
    await server.start();
    serverUrl = `postgresql://postgres:test@localhost:${port}/postgres`;
    stop = async () => {
      await server.stop();
    };
  }
  const dbName = `restora_test_${Date.now()}`;
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();
  const url = new URL(serverUrl);
  url.pathname = `/${dbName}`;
  process.env.DATABASE_URL = url.toString();
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  process.env.ADMIN_EMAILS = "owner@restora.test";

  return async () => {
    const c = new pg.Client({ connectionString: serverUrl });
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
    await c.end();
    if (stop) await stop();
  };
}
