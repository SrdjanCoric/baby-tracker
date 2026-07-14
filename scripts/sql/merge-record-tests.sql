-- merge_record write-path assertions (task 0003).
--
-- Covers the SQL-specific cases the shared vectors can't: table-name allowlist rejection, the
-- row-does-not-exist insert path, field-wise merge against an existing row, tombstone writes,
-- the babies household-scoped access branch, and RLS enforcement (an outsider cannot merge into
-- another household's rows). Concurrent-call atomicity is exercised separately by
-- run-sql-vectors.mjs (two parallel connections).
--
-- Runs inside a transaction that is rolled back at the end, so it is repeatable. Any failed
-- assertion RAISEs, which aborts the run (psql ON_ERROR_STOP) and fails the CI gate.

\set ON_ERROR_STOP on
BEGIN;

-- ---- seed: u1 + u2 in one household, u3 an outsider, one baby in u1/u2's household ----
DO $$
DECLARE
  h1 uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111', 'u1@test.dev');
  INSERT INTO auth.users (id, email) VALUES ('22222222-2222-2222-2222-222222222222', 'u2@test.dev');
  INSERT INTO auth.users (id, email) VALUES ('33333333-3333-3333-3333-333333333333', 'u3@test.dev');

  SELECT household_id INTO h1 FROM users WHERE id = '11111111-1111-1111-1111-111111111111';
  UPDATE users SET household_id = h1 WHERE id = '22222222-2222-2222-2222-222222222222';

  INSERT INTO babies (id, household_id, name)
  VALUES ('a0000000-0000-0000-0000-000000000001', h1, 'Test Baby');
END $$;
\echo 'ok: seed (two-caregiver household + outsider + baby)'

-- ---- 1. allowlist: unknown table is rejected ----
DO $$
DECLARE raised boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  BEGIN
    PERFORM merge_record('user_settings',
      jsonb_build_object('id', gen_random_uuid()::text, 'baby_id', 'a0000000-0000-0000-0000-000000000001'));
  EXCEPTION WHEN OTHERS THEN raised := true;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'expected allowlist rejection for non-mergeable table'; END IF;
END $$;
\echo 'ok: allowlist rejects a non-mergeable table'

-- ---- 2. insert path: row does not exist -> inserted with values + field_clocks ----
DO $$
DECLARE row_notes text; row_amt numeric; row_clock text; row_deleted boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  PERFORM merge_record('feedings',
    jsonb_build_object(
      'id', 'f0000000-0000-0000-0000-000000000001',
      'baby_id', 'a0000000-0000-0000-0000-000000000001',
      'type', 'bottle',
      'amount_ml', 100,
      'notes', 'first',
      'started_at', '2026-07-04T10:00:00Z',
      'created_at', '2026-07-04T10:00:00Z'
    ),
    jsonb_build_object(
      'notes', '2026-07-04T10:00:00.000Z-0000-device-a',
      'amount_ml', '2026-07-04T10:00:00.000Z-0000-device-a'
    ));

  SELECT notes, amount_ml, field_clocks ->> 'notes', deleted
  INTO row_notes, row_amt, row_clock, row_deleted
  FROM feedings WHERE id = 'f0000000-0000-0000-0000-000000000001';

  IF row_notes <> 'first' OR row_amt <> 100 THEN
    RAISE EXCEPTION 'insert wrote wrong values: notes=% amount=%', row_notes, row_amt;
  END IF;
  IF row_clock <> '2026-07-04T10:00:00.000Z-0000-device-a' THEN
    RAISE EXCEPTION 'insert wrote wrong clock: %', row_clock;
  END IF;
  IF row_deleted <> false THEN RAISE EXCEPTION 'insert should default deleted=false'; END IF;
END $$;
\echo 'ok: insert path writes row + field_clocks, deleted defaults false'

-- ---- 3. field-wise merge: newer notes wins, older amount is kept ----
DO $$
DECLARE row_notes text; row_amt numeric; clk_notes text; clk_amt text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  -- notes clock is newer (10:05 device-b); amount clock is OLDER (09:00 < existing 10:00) so amount is kept.
  PERFORM merge_record('feedings',
    jsonb_build_object(
      'id', 'f0000000-0000-0000-0000-000000000001',
      'baby_id', 'a0000000-0000-0000-0000-000000000001',
      'amount_ml', 250,
      'notes', 'edited'
    ),
    jsonb_build_object(
      'notes', '2026-07-04T10:05:00.000Z-0000-device-b',
      'amount_ml', '2026-07-04T09:00:00.000Z-0000-device-b'
    ));

  SELECT notes, amount_ml, field_clocks ->> 'notes', field_clocks ->> 'amount_ml'
  INTO row_notes, row_amt, clk_notes, clk_amt
  FROM feedings WHERE id = 'f0000000-0000-0000-0000-000000000001';

  IF row_notes <> 'edited' THEN RAISE EXCEPTION 'newer notes should win, got %', row_notes; END IF;
  IF row_amt <> 100 THEN RAISE EXCEPTION 'older amount should be kept at 100, got %', row_amt; END IF;
  IF clk_notes <> '2026-07-04T10:05:00.000Z-0000-device-b' THEN RAISE EXCEPTION 'notes clock not advanced: %', clk_notes; END IF;
  IF clk_amt <> '2026-07-04T10:00:00.000Z-0000-device-a' THEN RAISE EXCEPTION 'amount clock changed unexpectedly: %', clk_amt; END IF;
END $$;
\echo 'ok: field-wise merge keeps the per-field winner (no lost fields)'

-- ---- 4. tombstone: newer deleted=true wins; other fields survive ----
DO $$
DECLARE row_deleted boolean; row_notes text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  PERFORM merge_record('feedings',
    jsonb_build_object(
      'id', 'f0000000-0000-0000-0000-000000000001',
      'baby_id', 'a0000000-0000-0000-0000-000000000001',
      'deleted', true
    ),
    jsonb_build_object('deleted', '2026-07-04T11:00:00.000Z-0000-device-a'));

  SELECT deleted, notes INTO row_deleted, row_notes
  FROM feedings WHERE id = 'f0000000-0000-0000-0000-000000000001';

  IF row_deleted <> true THEN RAISE EXCEPTION 'tombstone should set deleted=true'; END IF;
  IF row_notes <> 'edited' THEN RAISE EXCEPTION 'concurrent field should survive delete, got %', row_notes; END IF;
END $$;
\echo 'ok: tombstone write sets deleted=true, sibling field survives'

-- ---- 5. babies branch: household-scoped access + insert ----
DO $$
DECLARE h1 uuid; row_name text;
BEGIN
  SELECT household_id INTO h1 FROM users WHERE id = '11111111-1111-1111-1111-111111111111';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  PERFORM merge_record('babies',
    jsonb_build_object('id', 'b0000000-0000-0000-0000-000000000001', 'household_id', h1::text, 'name', 'Junior'),
    jsonb_build_object('name', '2026-07-04T10:00:00.000Z-0000-device-a'));

  SELECT name INTO row_name FROM babies WHERE id = 'b0000000-0000-0000-0000-000000000001';
  IF row_name <> 'Junior' THEN RAISE EXCEPTION 'babies merge failed, got %', row_name; END IF;
END $$;
\echo 'ok: babies household-scoped merge inserts'

-- ---- 6. RLS: an outsider cannot merge into another household's row ----
DO $$
DECLARE raised boolean := false; row_notes text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  BEGIN
    PERFORM merge_record('feedings',
      jsonb_build_object(
        'id', 'f0000000-0000-0000-0000-000000000001',
        'baby_id', 'a0000000-0000-0000-0000-000000000001',
        'notes', 'hacked'
      ),
      jsonb_build_object('notes', '2026-07-04T12:00:00.000Z-0000-device-x'));
  EXCEPTION WHEN OTHERS THEN raised := true;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'expected access denied for outsider'; END IF;

  SELECT notes INTO row_notes FROM feedings WHERE id = 'f0000000-0000-0000-0000-000000000001';
  IF row_notes = 'hacked' THEN RAISE EXCEPTION 'outsider must not modify the row'; END IF;
END $$;
\echo 'ok: RLS rejects cross-household merge'

-- ---- 7. legacy row (empty clocks, as ADD COLUMN DEFAULT backfills) loses to a clocked write ----
DO $$
DECLARE row_notes text; row_clock text;
BEGIN
  -- A directly-inserted row simulates a legacy row: field_clocks defaults to '{}'.
  INSERT INTO feedings (id, baby_id, type, started_at, notes)
  VALUES ('f0000000-0000-0000-0000-0000000000aa', 'a0000000-0000-0000-0000-000000000001',
          'bottle', '2026-07-04T08:00:00Z', 'legacy');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  PERFORM merge_record('feedings',
    jsonb_build_object(
      'id', 'f0000000-0000-0000-0000-0000000000aa',
      'baby_id', 'a0000000-0000-0000-0000-000000000001',
      'notes', 'clocked'
    ),
    jsonb_build_object('notes', '2026-07-04T09:00:00.000Z-0000-device-a'));

  SELECT notes, field_clocks ->> 'notes' INTO row_notes, row_clock
  FROM feedings WHERE id = 'f0000000-0000-0000-0000-0000000000aa';

  IF row_notes <> 'clocked' THEN RAISE EXCEPTION 'clocked write should beat legacy empty clock, got %', row_notes; END IF;
  IF row_clock <> '2026-07-04T09:00:00.000Z-0000-device-a' THEN RAISE EXCEPTION 'clock not stamped on legacy overwrite: %', row_clock; END IF;
END $$;
\echo 'ok: legacy row (empty clocks) loses to a clocked write'

-- ---- 8. id-collision hijack: caller owns the incoming baby but not the existing row ----
DO $$
DECLARE h3 uuid; raised boolean := false; row_notes text;
BEGIN
  -- u3's own household + baby, and an existing feeding under it (owned by u3, not u1).
  SELECT household_id INTO h3 FROM users WHERE id = '33333333-3333-3333-3333-333333333333';
  INSERT INTO babies (id, household_id, name)
  VALUES ('a0000000-0000-0000-0000-0000000000c3', h3, 'Outsider Baby');
  INSERT INTO feedings (id, baby_id, type, started_at, notes)
  VALUES ('f0000000-0000-0000-0000-0000000000c3', 'a0000000-0000-0000-0000-0000000000c3',
          'bottle', '2026-07-04T08:00:00Z', 'private');

  -- u1 supplies a baby_id it DOES own, but the id of u3's row → must be rejected.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  BEGIN
    PERFORM merge_record('feedings',
      jsonb_build_object(
        'id', 'f0000000-0000-0000-0000-0000000000c3',
        'baby_id', 'a0000000-0000-0000-0000-000000000001',
        'notes', 'hijacked'
      ),
      jsonb_build_object('notes', '2026-07-04T12:00:00.000Z-0000-device-a'));
  EXCEPTION WHEN OTHERS THEN raised := true;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'expected access denied for existing-row id collision'; END IF;

  SELECT notes INTO row_notes FROM feedings WHERE id = 'f0000000-0000-0000-0000-0000000000c3';
  IF row_notes <> 'private' THEN RAISE EXCEPTION 'existing row must not be hijacked, got %', row_notes; END IF;
END $$;
\echo 'ok: id-collision cannot hijack another household''s row'

-- ---- 9. minimal insert: omitted columns keep their DEFAULT (not clobbered to NULL) ----
DO $$
DECLARE row_created timestamptz; row_updated timestamptz; row_deleted boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  -- Client sends only the required + one edited field; created_at/updated_at are omitted.
  PERFORM merge_record('feedings',
    jsonb_build_object(
      'id', 'f0000000-0000-0000-0000-0000000000d9',
      'baby_id', 'a0000000-0000-0000-0000-000000000001',
      'type', 'bottle',
      'started_at', '2026-07-04T10:00:00Z'
    ),
    '{}'::jsonb);

  SELECT created_at, updated_at, deleted INTO row_created, row_updated, row_deleted
  FROM feedings WHERE id = 'f0000000-0000-0000-0000-0000000000d9';

  IF row_created IS NULL THEN RAISE EXCEPTION 'created_at DEFAULT should apply on minimal insert'; END IF;
  IF row_updated IS NULL THEN RAISE EXCEPTION 'updated_at should be stamped on insert'; END IF;
  IF row_deleted <> false THEN RAISE EXCEPTION 'deleted should default false'; END IF;
END $$;
\echo 'ok: minimal insert applies column defaults, stamps updated_at'

-- ---- 10. partial delta update: baby_id omitted, ownership derived from the existing row ----
DO $$
DECLARE row_notes text; after_updated timestamptz;
BEGIN
  -- Force an old updated_at so the merge's bump is observable (now() is constant within this txn).
  UPDATE feedings SET updated_at = '2020-01-01T00:00:00Z'
  WHERE id = 'f0000000-0000-0000-0000-0000000000d9';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  -- Only id + the changed field are sent (no baby_id) — must NOT be access-denied for an owned row.
  PERFORM merge_record('feedings',
    jsonb_build_object('id', 'f0000000-0000-0000-0000-0000000000d9', 'notes', 'delta-edit'),
    jsonb_build_object('notes', '2026-07-04T11:00:00.000Z-0000-device-b'));

  SELECT notes, updated_at INTO row_notes, after_updated
  FROM feedings WHERE id = 'f0000000-0000-0000-0000-0000000000d9';

  IF row_notes <> 'delta-edit' THEN RAISE EXCEPTION 'partial delta should merge notes, got %', row_notes; END IF;
  IF after_updated <= '2020-01-01T00:00:00Z'::timestamptz THEN
    RAISE EXCEPTION 'updated_at should be bumped on merge, got %', after_updated;
  END IF;
END $$;
\echo 'ok: partial delta (no baby_id) merges via existing-row ownership, bumps updated_at'

-- ---- 11. tombstone delete of a row the server never saw is a no-op (id + deleted, no baby_id) ----
DO $$
DECLARE v_result jsonb; v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  -- A delete arrives as {id, deleted:true} with no baby_id. The row was never on the server
  -- (its CREATE was quarantined, or it was purely local), so there is nothing to tombstone.
  v_result := merge_record('feedings',
    jsonb_build_object('id', 'f0000000-0000-0000-0000-0000000000e1', 'deleted', true),
    jsonb_build_object('deleted', '2026-07-04T12:00:00.000Z-0000-device-b'));

  IF v_result IS NOT NULL THEN
    RAISE EXCEPTION 'tombstone delete of a missing row should return NULL, got %', v_result;
  END IF;
  SELECT count(*) INTO v_count FROM feedings WHERE id = 'f0000000-0000-0000-0000-0000000000e1';
  IF v_count <> 0 THEN RAISE EXCEPTION 'tombstone delete of a missing row must not insert a row'; END IF;
END $$;
\echo 'ok: tombstone delete of a non-existent row is a no-op (no throw, no insert)'

-- ---- 12. queued replay: the same operation id applies its merge exactly once ----
DO $$
DECLARE row_notes text; ack_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  PERFORM merge_record(
    'feedings',
    jsonb_build_object(
      'id', 'f0000000-0000-0000-0000-0000000000f2',
      'baby_id', 'a0000000-0000-0000-0000-000000000001',
      'type', 'bottle',
      'started_at', '2026-07-04T10:00:00Z',
      'notes', 'first-application'
    ),
    jsonb_build_object('notes', '2026-07-04T13:00:00.000Z-0000-device-a'),
    'sql-idempotency-op',
    '11111111-1111-1111-1111-111111111111'
  );
  PERFORM merge_record(
    'feedings',
    jsonb_build_object(
      'id', 'f0000000-0000-0000-0000-0000000000f2',
      'baby_id', 'a0000000-0000-0000-0000-000000000001',
      'notes', 'must-not-replay'
    ),
    jsonb_build_object('notes', '2026-07-04T14:00:00.000Z-0000-device-b'),
    'sql-idempotency-op',
    '11111111-1111-1111-1111-111111111111'
  );

  SELECT notes INTO row_notes FROM feedings
  WHERE id = 'f0000000-0000-0000-0000-0000000000f2';
  SELECT count(*) INTO ack_count FROM sync_operation_acknowledgements
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND operation_id = 'sql-idempotency-op';
  IF row_notes <> 'first-application' THEN
    RAISE EXCEPTION 'same-id replay applied twice, got notes=%', row_notes;
  END IF;
  IF ack_count <> 1 THEN RAISE EXCEPTION 'expected one acknowledgement, got %', ack_count; END IF;
END $$;
\echo 'ok: queued operation id is acknowledged and applied exactly once'

-- ---- 13. immutable actor: the session user must match p_expected_user_id ----
DO $$
DECLARE raised boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  BEGIN
    PERFORM merge_record(
      'feedings',
      jsonb_build_object('id', 'f0000000-0000-0000-0000-0000000000f2', 'notes', 'wrong-actor'),
      jsonb_build_object('notes', '2026-07-04T15:00:00.000Z-0000-device-b'),
      'sql-wrong-actor-op',
      '11111111-1111-1111-1111-111111111111'
    );
  EXCEPTION WHEN insufficient_privilege THEN raised := true;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'expected immutable actor rejection'; END IF;
END $$;
\echo 'ok: queued operation rejects a changed authenticated user'

-- ---- 14. acknowledgement and merge are atomic on failure ----
DO $$
DECLARE raised boolean := false; ack_count int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  BEGIN
    PERFORM merge_record(
      'not_mergeable', '{}'::jsonb, '{}'::jsonb,
      'sql-failed-merge-op',
      '11111111-1111-1111-1111-111111111111'
    );
  EXCEPTION WHEN OTHERS THEN raised := true;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'expected underlying merge failure'; END IF;
  SELECT count(*) INTO ack_count FROM sync_operation_acknowledgements
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND operation_id = 'sql-failed-merge-op';
  IF ack_count <> 0 THEN RAISE EXCEPTION 'failed merge must not be acknowledged'; END IF;
END $$;
\echo 'ok: a failed merge leaves no acknowledgement'

-- ---- 15. authenticated clients can execute only the bound overload ----
DO $$
BEGIN
  IF has_function_privilege(
    'authenticated', 'public.merge_record(text,jsonb,jsonb)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated must not execute the legacy merge overload';
  END IF;
  IF NOT has_function_privilege(
    'authenticated', 'public.merge_record(text,jsonb,jsonb,text,uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated must execute the bound merge overload';
  END IF;
END $$;
\echo 'ok: authenticated cannot bypass actor binding or idempotency'

ROLLBACK;
