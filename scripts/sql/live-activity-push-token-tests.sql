\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users(id, email) VALUES
  ('93111111-1111-1111-1111-111111111111', 'la-owner@test.dev'),
  ('93222222-2222-2222-2222-222222222222', 'la-member@test.dev'),
  ('93333333-3333-3333-3333-333333333333', 'la-outsider@test.dev');
UPDATE public.users SET household_id = (
  SELECT household_id FROM public.users WHERE id = '93111111-1111-1111-1111-111111111111'
) WHERE id = '93222222-2222-2222-2222-222222222222';
INSERT INTO public.babies(id, household_id, name)
SELECT '93a00000-0000-0000-0000-000000000001', household_id, 'Live Activity Baby'
FROM public.users WHERE id = '93111111-1111-1111-1111-111111111111';
INSERT INTO public.active_timers(baby_id, activity_type, started_by, timer_data)
VALUES ('93a00000-0000-0000-0000-000000000001', 'sleep', '93111111-1111-1111-1111-111111111111', '{"timerInstanceId":"run-93"}');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93111111-1111-1111-1111-111111111111', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.register_live_activity_push_token('93a00000-0000-0000-0000-000000000001', 'run-93', 'wrong-user', repeat('a',64), false, '93222222-2222-2222-2222-222222222222');
    RAISE EXCEPTION 'in-flight registration must not cross an auth change';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF NOT public.register_live_activity_push_token('93a00000-0000-0000-0000-000000000001', 'run-93', 'local-activity', repeat('a',64), false, auth.uid())
  THEN RAISE EXCEPTION 'active timer registration failed'; END IF;
  PERFORM public.register_live_activity_push_token('93a00000-0000-0000-0000-000000000001', 'run-93', 'local-activity', repeat('b',64), false, auth.uid());
  IF (SELECT count(*) FROM public.live_activity_push_tokens) <> 1
    OR (SELECT device_token FROM public.live_activity_push_tokens) <> repeat('b',64)
  THEN RAISE EXCEPTION 'rotation must replace the old token'; END IF;
END $$;

SAVEPOINT token_limit;
DO $$ BEGIN
  FOR i IN 1..7 LOOP
    PERFORM public.register_live_activity_push_token('93a00000-0000-0000-0000-000000000001', 'run-93', 'extra-' || i, repeat('a',64), false, auth.uid());
  END LOOP;
  BEGIN
    PERFORM public.register_live_activity_push_token('93a00000-0000-0000-0000-000000000001', 'run-93', 'overflow', repeat('a',64), false, auth.uid());
    RAISE EXCEPTION 'unbounded registration accepted';
  EXCEPTION WHEN program_limit_exceeded THEN NULL; END;
  PERFORM public.register_live_activity_push_token('93a00000-0000-0000-0000-000000000001', 'run-93', 'local-activity', repeat('f',64), false, auth.uid());
  IF (SELECT count(*) FROM public.live_activity_push_tokens) <> 8 THEN
    RAISE EXCEPTION 'cap must allow eight devices and rotation'; END IF;
END $$;
ROLLBACK TO SAVEPOINT token_limit;

SELECT set_config('request.jwt.claim.sub', '93222222-2222-2222-2222-222222222222', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.live_activity_push_tokens) THEN
    RAISE EXCEPTION 'household member can read another user token'; END IF;
  DELETE FROM public.live_activity_push_tokens;
  IF NOT public.register_live_activity_push_token('93a00000-0000-0000-0000-000000000001', 'run-93', 'future-mirrored-activity', repeat('c',64), true, auth.uid())
  THEN RAISE EXCEPTION 'future mirrored activities must be supported'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '93333333-3333-3333-3333-333333333333', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.register_live_activity_push_token('93a00000-0000-0000-0000-000000000001', 'run-93', 'outsider', repeat('d',64), false, auth.uid());
    RAISE EXCEPTION 'outsider registered for another household';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.live_activity_push_tokens) THEN
    RAISE EXCEPTION 'outsider can read tokens'; END IF;
  IF has_table_privilege('authenticated','public.live_activity_push_tokens','INSERT')
    OR has_table_privilege('authenticated','public.live_activity_push_tokens','UPDATE')
    OR has_function_privilege('anon','public.register_live_activity_push_token(uuid,text,text,text,boolean,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'registration bypass is permitted'; END IF;
END $$;

RESET ROLE;
DELETE FROM public.active_timers WHERE baby_id = '93a00000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.live_activity_push_tokens WHERE timer_instance_id = 'run-93') <> 2
  THEN RAISE EXCEPTION 'DELETE must retain tokens for the asynchronous webhook'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93111111-1111-1111-1111-111111111111', true);
DO $$ BEGIN
  IF public.register_live_activity_push_token('93a00000-0000-0000-0000-000000000001', 'run-93', 'late-activity', repeat('e',64), false, auth.uid())
  THEN RAISE EXCEPTION 'late registration must not resurrect an ended timer'; END IF;
  DELETE FROM public.live_activity_push_tokens WHERE activity_id = 'local-activity';
  IF EXISTS (SELECT 1 FROM public.live_activity_push_tokens) THEN
    RAISE EXCEPTION 'owner cleanup failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
\echo 'PASS: Live Activity token rotation, ownership, mirrored devices, late registration and cleanup'
