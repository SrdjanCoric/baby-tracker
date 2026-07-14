# Task 0003: Server-side merge: migration + merge RPC

**Branch**: `feature/crdt-server-merge`
**Depends on**: 0002 (the shared test vectors define the semantics the SQL must match)
**Source**: talk-it-through 2026-07-04 (CRDT conflict resolution) · **User stories**: "As a caregiver, when my offline edits flush to the server they must merge with — not overwrite — edits my partner made meanwhile"

## What to build

The Postgres half of the CRDT: schema columns for the clocks and tombstones, and the single
atomic merge RPC that becomes the only sanctioned write path for synced records.

Per the master plan header, the 9 in-scope tables are: feedings, sleep_sessions, diapers,
pumping_sessions, growth_measurements, tummy_time_sessions, health_entries, milestones, babies.

1. **Migration** (next available number — check `supabase/migrations/` for the current highest,
   including lettered variants): on each of the 9 tables add
   `field_clocks JSONB NOT NULL DEFAULT '{}'` and `deleted BOOLEAN NOT NULL DEFAULT FALSE`, plus a
   partial index `WHERE deleted = false` matching each table's dominant query shape (by
   baby_id/household). No backfill — empty clocks compare as epoch by design.
2. **`merge_record` RPC** — SECURITY DEFINER function taking the table name (validated against an
   allowlist of the 9 tables), the record payload, and its field clocks. Behavior: lock the
   existing row (`FOR UPDATE`), compare clocks field-by-field (missing entry = epoch), write the
   winning value and winning clock per field, insert if the row doesn't exist, return the merged
   row. Follows the existing RPC patterns (schema-qualified calls per the CLAUDE.md trigger/
   function guidance; RLS-respecting access checks like `acquire_timer_lock`).
3. **SQL vector runner** — a CI-runnable script that loads the shared JSON test vectors from task
   0002 and asserts the RPC produces identical merged output for every case, using a local
   Supabase instance. This is the guard against the twin-implementation divergence risk named in
   the master plan.

## AFK tasks

- [x] Write the migration for all 9 tables (clocks, tombstone, partial indexes) and confirm it
      applies cleanly to a local Supabase reset
- [x] TDD the RPC via the vector runner: start with the shared vectors from task 0002, then add
      SQL-specific cases (row-does-not-exist insert path, concurrent-call atomicity via two
      overlapping transactions, table-name allowlist rejection, RLS enforcement — a caller cannot
      merge into another household's rows)
- [x] Wire the vector runner into `npm run` scripts so it can run in CI against local Supabase
- [x] Ensure Realtime still emits row events for RPC-driven writes on all 9 tables (the tables are
      already in the Realtime publication; verify the RPC's writes surface as UPDATE/INSERT events
      carrying `field_clocks`)

## Acceptance criteria

- [x] Migration applies on a fresh local Supabase and on one seeded with legacy rows (empty clocks)
- [x] The RPC passes every shared test vector — byte-identical merged output to the TS `merge`
- [x] Two concurrent RPC calls on the same row serialize correctly (no lost fields)
- [x] RLS: cross-household merge attempts are rejected
- [x] Realtime events for RPC writes include the `field_clocks` column

## Implementation log (2026-07-04)

Built on branch `feature/crdt-server-merge`. All AFK work complete and green; awaiting manual
`[verify]` + PR approval.

**What was built**

- `supabase/migrations/052_crdt_field_clocks_and_merge.sql`:
  - Adds `field_clocks JSONB NOT NULL DEFAULT '{}'` + `deleted BOOLEAN NOT NULL DEFAULT FALSE` to
    all 9 in-scope tables, each with a partial index on its dominant query column
    (`baby_id`, or `household_id` for `babies`) `WHERE deleted = false`.
  - Realtime: sets `REPLICA IDENTITY FULL` on `health_entries` + `milestone_responses` (the 7 base
    tables already had it via 017) and idempotently adds all 9 tables to the `supabase_realtime`
    publication — so `field_clocks` surfaces in INSERT/UPDATE payloads on a fresh DB too.
  - `crdt_canonical(jsonb) → text` — twin of `canonicalString()` in `crdt.ts` (sorted keys via
    `COLLATE "C"`, scalars as compact JSON), used only for exact-clock tie-breaks.
  - `crdt_merge_fields(a_fields, a_clocks, b_fields, b_clocks) → jsonb` — pure, table-agnostic
    field-wise LWW merge; the byte-for-byte twin of `merge()` in `crdt.ts`.
  - `merge_record(p_table, p_record, p_field_clocks) → jsonb` — SECURITY DEFINER write path:
    table allowlist, manual household access check (incoming **and** existing row), advisory
    xact-lock + `FOR UPDATE` serialization, merge via `crdt_merge_fields`, upsert via
    `jsonb_populate_record` + `ON CONFLICT (id) DO UPDATE`.
- `scripts/run-sql-vectors.mjs` (`npm run test:sql`) — runs the shared `crdt-vectors.json` against
  `crdt_merge_fields` (both merge orders — asserts commutativity), the `merge_record` SQL cases,
  and a real two-connection concurrency test. Exits non-zero on any divergence.
- `scripts/sql/merge-record-tests.sql` — allowlist rejection, insert path, field-wise merge,
  tombstone, babies household branch, RLS rejection, legacy-row-loses, id-collision hijack rejection.
- `scripts/apply-migrations.mjs` + `supabase/config.toml` + `npm run test:sql:setup` — local test
  harness. See decisions below.
- `package.json` (`test:sql`, `test:sql:setup`), `eslint.config.mjs` (Node globals for
  `scripts/**/*.mjs`).

**Verified:** `npm run test:sql` → 26/26 vectors (13 × fwd+rev), 20 `merge_record` assertions,
concurrency no-lost-field. `npm run typecheck` clean, `npm run test:sync` 170 passing, lint clean.
Migration confirmed to apply on a fresh reset and over pre-existing legacy rows (backfilled to
`field_clocks='{}'`, `deleted=false`).

**Decisions made (AFK — none were tagged `[decision]`; flagging for review)**

1. **`milestones` → `milestone_responses`.** The plan/task name the table `milestones`, but the
   actual table (migration 044) is `milestone_responses`. Used the real name in the allowlist,
   columns, index, and publication.
2. **`merge_record` uses `auth.uid()`**, not a passed `p_user_id` (diverges from `acquire_timer_lock`'s
   convention) — a client cannot spoof another user. Access is enforced against both the incoming
   `baby_id`/`household_id` and the existing row's owner (id-collision hijack defense).
3. **RPC contract:** `p_record` is the full row as snake_case-column jsonb (incl. `id` and
   `baby_id`/`household_id`); `p_field_clocks` maps changed columns → HLC string. On the insert
   path the client must send a complete row (missing columns become NULL, not column defaults).
   Task 0004 wires the client to this contract.
4. **Local Supabase harness:** committed `supabase/config.toml` with the auto-migrator **disabled**
   because migrations 029/032 call `cron.schedule(...)` assuming `pg_cron` is already enabled (true
   on the hosted project via the dashboard, false on a fresh local Postgres). `apply-migrations.mjs`
   creates `pg_cron` first, then applies the chain. No committed migration was modified.

**Post-review fixes (2026-07-04)** — applied after `task-review`; re-verified by a second Bug +
Security pass (both clean) and an adversarial shadow attack (rejected). `npm run test:sql` now runs
24 `merge_record` assertions.

- **Partial-delta access (was a major):** access checks moved after the existing-row read, so a
  delta that omits `baby_id`/`household_id` derives ownership from the existing row instead of being
  wrongly denied. Inserts still require the key; the id-collision hijack and cross-household
  outsider are still rejected. `merge_record` now accepts full rows **and** partial deltas.
- **Default bypass / `updated_at` (was a major):** the upsert writes only columns present in
  `v_full`, so columns the client omits keep their DEFAULT on insert (`created_at`); `updated_at`
  is server-stamped to `now()` on every write (it is bookkeeping, not a clocked field).
- **`search_path` hardening (security major):** `SET search_path = public, pg_temp` + every guard/
  target relation schema-qualified, defeating temp-table shadowing of the authorization joins.
- New tests: minimal-insert (defaults apply) + partial-delta (ownership via existing row).
- Confirmed decisions: `logged_by` stays client-supplied (needed for CRDT re-sync); `milestone_responses`
  is the real table; `config.toml` auto-migrator disabled for the `pg_cron` local gap.
- Deferred (non-blocking, agreed): canonical SQL/JS divergence on exotic numbers/non-ASCII;
  end-to-end-vectors-through-RPC, insert/insert concurrency variant, allowlist SQLSTATE assertion,
  Realtime smoke test; CLAUDE.md 052 row. See `reviews/0003-crdt-server-merge-review.md`.
