#!/usr/bin/env node
/**
 * Apply the full migration chain to the running local Supabase database.
 *
 * The Supabase auto-migrator is disabled in config.toml (`[db.migrations] enabled = false`)
 * because migrations 029 and 032 call `cron.schedule(...)`, which assumes the `pg_cron`
 * extension is already enabled — true on the hosted project (enabled via the dashboard) but
 * not on a fresh local Postgres. This applier creates `pg_cron` first, then runs every
 * migration file in `supabase/migrations` in sorted order, so a local reset reproduces the
 * hosted schema without editing any committed migration.
 *
 * Run against a bare local DB (e.g. after `supabase db reset --no-seed`). Exits non-zero on
 * the first failing statement (psql `ON_ERROR_STOP`).
 *
 * Env:
 *   SUPABASE_DB_URL  override the connection string (default: local supabase db).
 */

import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const DB_URL =
  process.env.SUPABASE_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function psql(args, input) {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", ...args], {
    input,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });
}

// Enable pg_cron before any migration that schedules jobs.
psql([], "CREATE EXTENSION IF NOT EXISTS pg_cron;");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  process.stdout.write(`Applying ${file}...\n`);
  psql(["-f", join(MIGRATIONS_DIR, file)]);
}

process.stdout.write(`\nApplied ${files.length} migrations.\n`);
