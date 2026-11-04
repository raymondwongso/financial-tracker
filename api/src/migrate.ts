import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { pendingMigrations } from "./migrations.js";
import { createPool } from "./repositories/postgres/pool.js";

const migrationsDir = join(import.meta.dirname, "..", "db", "migrations");

const pool = createPool(loadConfig());
try {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
  const pending = pendingMigrations(
    await readdir(migrationsDir),
    rows.map((r) => r.name),
  );

  for (const name of pending) {
    const sql = await readFile(join(migrationsDir, name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`applied ${name}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  if (pending.length === 0) console.log("no pending migrations");
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
