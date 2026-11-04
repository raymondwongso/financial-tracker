import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pendingMigrations } from "./migrations.js";

const migrationsDir = join(import.meta.dirname, "..", "db", "migrations");

test("migration files are named NNN_name.sql and numbered consecutively from 001", () => {
  const files = readdirSync(migrationsDir).sort();
  assert.ok(files.length > 0);
  files.forEach((file, i) => {
    assert.match(file, /^\d{3}_[a-z0-9_]+\.sql$/);
    assert.equal(file.slice(0, 3), String(i + 1).padStart(3, "0"));
  });
});

test("pendingMigrations returns unapplied sql files in order", () => {
  const all = ["002_b.sql", "001_a.sql", "003_c.sql", "README.md"];
  assert.deepEqual(pendingMigrations(all, ["001_a.sql"]), ["002_b.sql", "003_c.sql"]);
});

test("pendingMigrations returns nothing when all applied", () => {
  assert.deepEqual(pendingMigrations(["001_a.sql"], ["001_a.sql"]), []);
});
