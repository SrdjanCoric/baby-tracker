-- Task 0005: server-side reminder reads must ignore CRDT tombstones.
--
-- Deletes are now `deleted: true` UPDATEs (not hard DELETEs), so the wake-window reminder
-- reads of sleep_sessions must exclude tombstoned rows. Each test seeds a real FK graph,
-- asserts via RAISE EXCEPTION (ON_ERROR_STOP makes psql exit non-zero on failure), and rolls
-- back so nothing persists. `auth.users` insert fires handle_new_user, which creates the
-- public.users row and a household — we read that household back rather than inserting one.

-- 1. Deleting the latest sleep via tombstone recomputes babies.last_sleep_ended_at,
--    excluding the tombstoned row (the denormalization the reminder cron reads).
BEGIN;
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  hid uuid; bid uuid;
  t1 timestamptz := now() - interval '3 hours';
  t2 timestamptz := now() - interval '1 hour';
  got timestamptz;
BEGIN
  INSERT INTO auth.users(id) VALUES (uid);
  SELECT household_id INTO hid FROM users WHERE id = uid;
  INSERT INTO babies(household_id, name) VALUES (hid, 'Test') RETURNING id INTO bid;

  INSERT INTO sleep_sessions(baby_id, type, started_at, ended_at, logged_by)
    VALUES (bid, 'nap', t1 - interval '30 min', t1, uid);
  INSERT INTO sleep_sessions(baby_id, type, started_at, ended_at, logged_by)
    VALUES (bid, 'nap', t2 - interval '30 min', t2, uid);

  SELECT last_sleep_ended_at INTO got FROM babies WHERE id = bid;
  IF got <> t2 THEN RAISE EXCEPTION 'last_sleep_ended_at expected t2 before delete, got %', got; END IF;

  UPDATE sleep_sessions SET deleted = true WHERE baby_id = bid AND ended_at = t2;

  SELECT last_sleep_ended_at INTO got FROM babies WHERE id = bid;
  IF got <> t1 THEN RAISE EXCEPTION 'tombstone did not recompute last_sleep_ended_at to t1, got %', got; END IF;

END $$;
ROLLBACK;
SELECT 'PASS: tombstone recomputes last_sleep_ended_at excluding the deleted sleep';

-- 2. get_due_wake_window_reminders nap count excludes tombstoned naps.
BEGIN;
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  hid uuid; bid uuid;
  n1 timestamptz := now() - interval '4 hours';
  n2 timestamptz := now() - interval '1 hour';
  naps bigint;
BEGIN
  INSERT INTO auth.users(id) VALUES (uid);
  SELECT household_id INTO hid FROM users WHERE id = uid;
  INSERT INTO babies(household_id, name) VALUES (hid, 'Test') RETURNING id INTO bid;

  INSERT INTO sleep_sessions(baby_id, type, started_at, ended_at, logged_by)
    VALUES (bid, 'nap', n1 - interval '40 min', n1, uid);
  INSERT INTO sleep_sessions(baby_id, type, started_at, ended_at, logged_by)
    VALUES (bid, 'nap', n2 - interval '40 min', n2, uid);

  INSERT INTO wake_window_preferences(baby_id, enabled) VALUES (bid, true);
  INSERT INTO user_push_tokens(user_id, push_token, device_type, device_token)
    VALUES (uid, 'x', 'ios', 'dt');

  SELECT naps_since_night_sleep INTO naps FROM get_due_wake_window_reminders() WHERE baby_id = bid;
  IF naps <> 2 THEN RAISE EXCEPTION 'expected 2 live naps, got %', naps; END IF;

  UPDATE sleep_sessions SET deleted = true WHERE baby_id = bid AND ended_at = n2;

  SELECT naps_since_night_sleep INTO naps FROM get_due_wake_window_reminders() WHERE baby_id = bid;
  IF naps <> 1 THEN RAISE EXCEPTION 'tombstoned nap still counted, got %', naps; END IF;

END $$;
ROLLBACK;
SELECT 'PASS: get_due_wake_window_reminders nap count excludes tombstoned naps';
