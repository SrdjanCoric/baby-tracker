#!/usr/bin/env node
/**
 * SQL CRDT vector runner — the guard against twin-implementation divergence.
 *
 * Runs the shared `crdt-vectors.json` (task 0002) against the Postgres `crdt_merge_fields`
 * RPC (task 0003) and asserts byte-identical merged output for every vector, in both
 * merge orders (a,b) and (b,a) — the merge must be commutative. Then runs the
 * SQL-specific `merge_record` write-path assertions in scripts/sql/merge-record-tests.sql.
 *
 * Requires a running, migrated local Supabase (`npm run test:sql:setup`). Connects via
 * `psql` — no extra npm dependency. Exits non-zero on any failure so it gates CI.
 *
 * Env:
 *   SUPABASE_DB_URL  override the connection string (default: local supabase db).
 */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_URL =
  process.env.SUPABASE_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

function sqlLiteral(value) {
  return "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
}

function psql(args, input) {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", ...args], {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function runVectors() {
  const { vectors } = JSON.parse(
    readFileSync(join(ROOT, "src/services/sync/crdt-vectors.json"), "utf8"),
  );

  const selects = [];
  for (const v of vectors) {
    const af = sqlLiteral(v.a.fields);
    const ac = sqlLiteral(v.a.fieldClocks);
    const bf = sqlLiteral(v.b.fields);
    const bc = sqlLiteral(v.b.fieldClocks);
    const expected = sqlLiteral({ fields: v.expected.fields, fieldClocks: v.expected.fieldClocks });
    const name = "'" + v.name.replaceAll("'", "''") + "'";
    // Forward (a, b) and reverse (b, a) — merge must be commutative.
    selects.push(
      `SELECT ${name} AS name, 'fwd' AS dir, ` +
        `crdt_merge_fields(${af}, ${ac}, ${bf}, ${bc}) = ${expected} AS ok, ` +
        `crdt_merge_fields(${af}, ${ac}, ${bf}, ${bc})::text AS got`,
    );
    selects.push(
      `SELECT ${name} AS name, 'rev' AS dir, ` +
        `crdt_merge_fields(${bf}, ${bc}, ${af}, ${ac}) = ${expected} AS ok, ` +
        `crdt_merge_fields(${bf}, ${bc}, ${af}, ${ac})::text AS got`,
    );
  }

  const query = selects.join("\nUNION ALL\n") + ";";
  const dir = mkdtempSync(join(tmpdir(), "crdt-vectors-"));
  const file = join(dir, "vectors.sql");
  writeFileSync(file, query);

  const out = psql(["-A", "-t", "-F", "\t", "-f", file]);
  const rows = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("\t"));

  let passed = 0;
  const failures = [];
  for (const [name, dir_, ok, got] of rows) {
    if (ok === "t") {
      passed += 1;
    } else {
      failures.push({ name, dir: dir_, got });
    }
  }
  return { total: rows.length, passed, failures };
}

function runMergeRecordTests() {
  const file = join(ROOT, "scripts/sql/merge-record-tests.sql");
  try {
    const out = psql(["-f", file]);
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: (err.stdout || "") + (err.stderr || "") };
  }
}

function runTombstoneReminderTests() {
  const file = join(ROOT, "scripts/sql/tombstone-reminder-tests.sql");
  try {
    const out = psql(["-f", file]);
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: (err.stdout || "") + (err.stderr || "") };
  }
}

function runActiveTimerAuthorizationTests() {
  const file = join(ROOT, "scripts/sql/active-timer-authorization-tests.sql");
  try {
    const out = psql(["-f", file]);
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: (err.stdout || "") + (err.stderr || "") };
  }
}

function runCaregiverInvitationTests() {
  const file = join(ROOT, "scripts/sql/caregiver-invitation-tests.sql");
  try {
    const out = psql(["-f", file]);
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: (err.stdout || "") + (err.stderr || "") };
  }
}

function runMorningClassificationTests() {
  const file = join(ROOT, "scripts/sql/morning-classification-tests.sql");
  try {
    const out = psql(["-f", file]);
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: (err.stdout || "") + (err.stderr || "") };
  }
}

function runBabyActivitySnapshotTests() {
  const file = join(ROOT, "scripts/sql/baby-activity-snapshot-tests.sql");
  try {
    const out = psql(["-f", file]);
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: (err.stdout || "") + (err.stderr || "") };
  }
}

// Two overlapping transactions merge the same row concurrently, each editing a different field
// with a newer clock. The advisory lock in merge_record must serialize them so neither field is
// lost. Worker A holds the lock (pg_sleep) so B provably waits and re-reads A's committed write.
const CC = {
  user: "c1111111-1111-1111-1111-111111111111",
  baby: "cbbbbbbb-0000-0000-0000-000000000001",
  feeding: "cfffffff-0000-0000-0000-000000000001",
};

function ccWorker(field, value, clock, sleepSeconds) {
  const claims = JSON.stringify({ sub: CC.user });
  const record = JSON.stringify({ id: CC.feeding, baby_id: CC.baby, [field]: value }).replaceAll(
    "'",
    "''",
  );
  const clocks = JSON.stringify({ [field]: clock }).replaceAll("'", "''");
  const sql =
    `BEGIN;` +
    `SELECT set_config('request.jwt.claims', '${claims.replaceAll("'", "''")}', true);` +
    `SELECT merge_record('feedings', '${record}'::jsonb, '${clocks}'::jsonb);` +
    `SELECT pg_sleep(${sleepSeconds});` +
    `COMMIT;`;
  return execFileAsync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql]);
}

async function runConcurrencyTest() {
  const seed = `
    INSERT INTO auth.users (id, email) VALUES ('${CC.user}', 'cc@test.dev') ON CONFLICT (id) DO NOTHING;
    INSERT INTO babies (id, household_id, name)
      SELECT '${CC.baby}', household_id, 'CC Baby' FROM users WHERE id = '${CC.user}'
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO feedings (id, baby_id, type, started_at)
      VALUES ('${CC.feeding}', '${CC.baby}', 'bottle', '2026-07-04T10:00:00Z')
      ON CONFLICT (id) DO NOTHING;`;
  const cleanup = `
    DELETE FROM feedings WHERE id = '${CC.feeding}';
    DELETE FROM babies WHERE id = '${CC.baby}';
    DELETE FROM auth.users WHERE id = '${CC.user}';`;

  psql(["-c", seed]);
  try {
    // A edits notes (holds lock 0.4s); B edits amount_ml (blocks until A commits).
    await Promise.all([
      ccWorker("notes", "from-A", "2026-07-04T10:05:00.000Z-0000-device-a", 0.4),
      ccWorker("amount_ml", 222, "2026-07-04T10:05:00.000Z-0000-device-b", 0),
    ]);
    const row = psql([
      "-A",
      "-t",
      "-F",
      "\t",
      "-c",
      `SELECT notes, amount_ml FROM feedings WHERE id = '${CC.feeding}'`,
    ]).trim();
    const [notes, amount] = row.split("\t");
    const ok = notes === "from-A" && Number(amount) === 222;
    return { ok, detail: `notes=${notes} amount_ml=${amount}` };
  } finally {
    psql(["-c", cleanup]);
  }
}

function idempotencyWorker(value, clock, sleepSeconds) {
  const claims = JSON.stringify({ sub: CC.user });
  const record = JSON.stringify({
    id: CC.feeding,
    baby_id: CC.baby,
    notes: value,
  }).replaceAll("'", "''");
  const clocks = JSON.stringify({ notes: clock }).replaceAll("'", "''");
  const sql =
    `BEGIN;` +
    `SELECT set_config('request.jwt.claims', '${claims.replaceAll("'", "''")}', true);` +
    `SELECT merge_record('feedings', '${record}'::jsonb, '${clocks}'::jsonb, ` +
    `'concurrent-same-operation', '${CC.user}'::uuid);` +
    `SELECT pg_sleep(${sleepSeconds});` +
    `COMMIT;`;
  return execFileAsync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql]);
}

async function runIdempotencyConcurrencyTest() {
  const seed = `
    INSERT INTO auth.users (id, email) VALUES ('${CC.user}', 'cc@test.dev') ON CONFLICT (id) DO NOTHING;
    INSERT INTO babies (id, household_id, name)
      SELECT '${CC.baby}', household_id, 'CC Baby' FROM users WHERE id = '${CC.user}'
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO feedings (id, baby_id, type, started_at)
      VALUES ('${CC.feeding}', '${CC.baby}', 'bottle', '2026-07-04T10:00:00Z')
      ON CONFLICT (id) DO NOTHING;
    DELETE FROM sync_operation_acknowledgements
      WHERE user_id = '${CC.user}' AND operation_id = 'concurrent-same-operation';`;
  const cleanup = `
    DELETE FROM sync_operation_acknowledgements
      WHERE user_id = '${CC.user}' AND operation_id = 'concurrent-same-operation';
    DELETE FROM feedings WHERE id = '${CC.feeding}';
    DELETE FROM babies WHERE id = '${CC.baby}';
    DELETE FROM auth.users WHERE id = '${CC.user}';`;

  psql(["-c", seed]);
  try {
    await Promise.all([
      idempotencyWorker("same-op-A", "2026-07-04T10:06:00.000Z-0000-device-a", 0.4),
      idempotencyWorker("same-op-B", "2026-07-04T10:07:00.000Z-0000-device-b", 0),
    ]);
    const row = psql([
      "-A",
      "-t",
      "-F",
      "\t",
      "-c",
      `SELECT f.notes, count(a.operation_id)
       FROM feedings f
       LEFT JOIN sync_operation_acknowledgements a
         ON a.user_id = '${CC.user}' AND a.operation_id = 'concurrent-same-operation'
       WHERE f.id = '${CC.feeding}'
       GROUP BY f.notes`,
    ]).trim();
    const [notes, count] = row.split("\t");
    const ok = ["same-op-A", "same-op-B"].includes(notes) && Number(count) === 1;
    return { ok, detail: `notes=${notes} acknowledgements=${count}` };
  } finally {
    psql(["-c", cleanup]);
  }
}

function runTimerCompletionReplayTest() {
  const operationIds = ["timer-completion-first", "timer-completion-retry"];
  const record = JSON.stringify({
    id: CC.feeding,
    baby_id: CC.baby,
    type: "breast",
    started_at: "2026-07-15T08:00:00.000Z",
    ended_at: "2026-07-15T08:05:00.000Z",
    duration_seconds: 300,
    logged_by: CC.user,
  }).replaceAll("'", "''");
  const clocks = JSON.stringify({
    type: "2026-07-15T08:05:00.000Z-0000-timer-device",
    started_at: "2026-07-15T08:05:00.000Z-0000-timer-device",
    ended_at: "2026-07-15T08:05:00.000Z-0000-timer-device",
    duration_seconds: "2026-07-15T08:05:00.000Z-0000-timer-device",
  }).replaceAll("'", "''");
  const claims = JSON.stringify({ sub: CC.user }).replaceAll("'", "''");
  const operationList = operationIds.map(id => `'${id}'`).join(", ");
  const sql = `
    INSERT INTO auth.users (id, email) VALUES ('${CC.user}', 'timer-replay@test.dev')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO babies (id, household_id, name)
      SELECT '${CC.baby}', household_id, 'Timer Replay Baby' FROM users WHERE id = '${CC.user}'
      ON CONFLICT (id) DO NOTHING;
    DELETE FROM sync_operation_acknowledgements
      WHERE user_id = '${CC.user}' AND operation_id IN (${operationList});
    SELECT set_config('request.jwt.claims', '${claims}', false);
    SELECT merge_record('feedings', '${record}'::jsonb, '${clocks}'::jsonb,
      '${operationIds[0]}', '${CC.user}'::uuid);
    SELECT merge_record('feedings', '${record}'::jsonb, '${clocks}'::jsonb,
      '${operationIds[1]}', '${CC.user}'::uuid);`;
  const cleanup = `
    DELETE FROM sync_operation_acknowledgements
      WHERE user_id = '${CC.user}' AND operation_id IN (${operationList});
    DELETE FROM feedings WHERE id = '${CC.feeding}';
    DELETE FROM babies WHERE id = '${CC.baby}';
    DELETE FROM auth.users WHERE id = '${CC.user}';`;

  psql(["-q", "-c", sql]);
  try {
    const row = psql([
      "-A",
      "-t",
      "-F",
      "\t",
      "-c",
      `SELECT count(*), ended_at, duration_seconds
       FROM feedings
       WHERE id = '${CC.feeding}'
       GROUP BY ended_at, duration_seconds`,
    ]).trim();
    const [count, endedAt, duration] = row.split("\t");
    const ok =
      Number(count) === 1 &&
      new Date(endedAt).toISOString() === "2026-07-15T08:05:00.000Z" &&
      Number(duration) === 300;
    return { ok, detail: `rows=${count} ended_at=${endedAt} duration=${duration}` };
  } finally {
    psql(["-q", "-c", cleanup]);
  }
}

console.log(`Running CRDT SQL vectors against ${DB_URL}\n`);

let hardFail = false;

const vec = runVectors();
for (const f of vec.failures) {
  console.log(`${RED}✗${RESET} ${f.name} (${f.dir})\n    got: ${f.got}`);
}
if (vec.failures.length === 0) {
  console.log(`${GREEN}✓${RESET} vectors: ${vec.passed}/${vec.total} (fwd + rev)`);
} else {
  console.log(`\n${RED}vectors: ${vec.passed}/${vec.total} passed${RESET}`);
  hardFail = true;
}

console.log("");
const mr = runMergeRecordTests();
if (mr.ok) {
  console.log(`${GREEN}✓${RESET} merge_record: ${mr.out.trim().split("\n").filter(Boolean).length} assertions passed`);
  process.stdout.write(mr.out);
} else {
  console.log(`${RED}✗ merge_record tests failed${RESET}`);
  process.stdout.write(mr.out);
  hardFail = true;
}

console.log("");
const tr = runTombstoneReminderTests();
if (tr.ok) {
  const passed = (tr.out.match(/PASS:/g) || []).length;
  console.log(`${GREEN}✓${RESET} tombstone reminders: ${passed} assertions passed (sleep reads ignore tombstones)`);
} else {
  console.log(`${RED}✗ tombstone reminder tests failed${RESET}`);
  process.stdout.write(tr.out);
  hardFail = true;
}

console.log("");
const timerAuthorization = runActiveTimerAuthorizationTests();
if (timerAuthorization.ok) {
  console.log(`${GREEN}✓${RESET} active timer authorization: RPC identity, household, ownership, grants, and valid owner flows`);
} else {
  console.log(`${RED}✗ active timer authorization tests failed${RESET}`);
  process.stdout.write(timerAuthorization.out);
  hardFail = true;
}

console.log("");
const caregiverInvitations = runCaregiverInvitationTests();
if (caregiverInvitations.ok) {
  console.log(`${GREEN}✓${RESET} caregiver invitations: owner management, staged compatibility, email cutover, expiry, revocation, single use, and rate limiting`);
} else {
  console.log(`${RED}✗ caregiver invitation tests failed${RESET}`);
  process.stdout.write(caregiverInvitations.out);
  hardFail = true;
}

console.log("");
const morningClassification = runMorningClassificationTests();
if (morningClassification.ok) {
  console.log(`${GREEN}✓${RESET} morning classification: legacy compatibility, partial updates, defaults, and RLS`);
} else {
  console.log(`${RED}✗ morning classification tests failed${RESET}`);
  process.stdout.write(morningClassification.out);
  hardFail = true;
}

console.log("");
const babyActivitySnapshot = runBabyActivitySnapshotTests();
if (babyActivitySnapshot.ok) {
  console.log(`${GREEN}✓${RESET} baby activity snapshot: authenticated invoker contract`);
} else {
  console.log(`${RED}✗ baby activity snapshot tests failed${RESET}`);
  process.stdout.write(babyActivitySnapshot.out);
  hardFail = true;
}

console.log("");
try {
  const cc = await runConcurrencyTest();
  if (cc.ok) {
    console.log(`${GREEN}✓${RESET} concurrency: two overlapping merges serialize, no lost field (${cc.detail})`);
  } else {
    console.log(`${RED}✗ concurrency: a field was lost (${cc.detail})${RESET}`);
    hardFail = true;
  }
} catch (err) {
  console.log(`${RED}✗ concurrency test error${RESET}\n${(err.stdout || "") + (err.stderr || "")}`);
  hardFail = true;
}

console.log("");
try {
  const replay = await runIdempotencyConcurrencyTest();
  if (replay.ok) {
    console.log(`${GREEN}✓${RESET} idempotency concurrency: same-id replays apply once (${replay.detail})`);
  } else {
    console.log(`${RED}✗ idempotency concurrency: same-id replay was not atomic (${replay.detail})${RESET}`);
    hardFail = true;
  }
} catch (err) {
  console.log(`${RED}✗ idempotency concurrency test error${RESET}\n${(err.stdout || "") + (err.stderr || "")}`);
  hardFail = true;
}

console.log("");
try {
  const timerReplay = runTimerCompletionReplayTest();
  if (timerReplay.ok) {
    console.log(`${GREEN}✓${RESET} timer completion replay: one completed row (${timerReplay.detail})`);
  } else {
    console.log(`${RED}✗ timer completion replay created divergent rows (${timerReplay.detail})${RESET}`);
    hardFail = true;
  }
} catch (err) {
  console.log(`${RED}✗ timer completion replay test error${RESET}\n${(err.stdout || "") + (err.stderr || "")}`);
  hardFail = true;
}

process.exit(hardFail ? 1 : 0);
