\set ON_ERROR_STOP on
BEGIN;
-- Exercise the same SELECT, DELETE and start-edit UPDATE as the timer service without
-- adding grants in the test; anonymous requests must reproduce the observed SQLSTATE.
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM id FROM public.active_timers;
    RAISE EXCEPTION 'anonymous timer reads unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLSTATE <> '42501' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.active_timers WHERE false;
    RAISE EXCEPTION 'anonymous pending releases unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLSTATE <> '42501' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.active_timers SET started_at = now() WHERE false;
    RAISE EXCEPTION 'anonymous pending edits unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLSTATE <> '42501' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF NOT has_table_privilege('authenticated','public.active_timers','SELECT, UPDATE, DELETE')
    OR NOT has_table_privilege('authenticated','public.users','SELECT')
    OR NOT has_table_privilege('authenticated','public.babies','SELECT') THEN
    RAISE EXCEPTION 'authenticated timer access or its policy dependencies lack privileges';
  END IF;
END $$;
INSERT INTO auth.users (id, email) VALUES
 ('81111111-1111-1111-1111-111111111111', 'timer-session-owner@test.dev'),
 ('82222222-2222-2222-2222-222222222222', 'timer-session-member@test.dev'),
 ('83333333-3333-3333-3333-333333333333', 'timer-session-outsider@test.dev');
UPDATE public.users SET household_id = (SELECT household_id FROM public.users WHERE id = '81111111-1111-1111-1111-111111111111')
 WHERE id = '82222222-2222-2222-2222-222222222222';
INSERT INTO public.babies (id, household_id, name)
 SELECT '8a000000-0000-0000-0000-000000000001', household_id, 'Timer Session Baby'
 FROM public.users WHERE id = '81111111-1111-1111-1111-111111111111';

SELECT set_config('request.jwt.claims', '{"sub":"81111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE n integer;
BEGIN
 PERFORM * FROM public.acquire_timer_lock('8a000000-0000-0000-0000-000000000001', 'sleep', '81111111-1111-1111-1111-111111111111', '{}', now());
 UPDATE public.active_timers SET started_at = now() - interval '1 minute'
 WHERE baby_id = '8a000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 1 THEN RAISE EXCEPTION 'starter could not replay a start edit'; END IF;
 SELECT count(*) INTO n FROM public.active_timers t LEFT JOIN public.users u ON u.id = t.started_by
 WHERE t.baby_id = '8a000000-0000-0000-0000-000000000001';
 IF n <> 1 THEN RAISE EXCEPTION 'owner cannot read the aggregate or individual lock'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"82222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.babies WHERE id = '8a000000-0000-0000-0000-000000000001' AND deleted = false;
 IF n <> 1 THEN RAISE EXCEPTION 'member preflight lost baby access'; END IF;
 SELECT count(*) INTO n FROM public.active_timers t LEFT JOIN public.users u ON u.id = t.started_by
 WHERE t.baby_id = '8a000000-0000-0000-0000-000000000001';
 IF n <> 1 THEN RAISE EXCEPTION 'member cannot read household locks'; END IF;
 DELETE FROM public.active_timers WHERE baby_id = '8a000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 1 THEN RAISE EXCEPTION 'member cannot release a household lock'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"83333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.babies WHERE id = '8a000000-0000-0000-0000-000000000001' AND deleted = false) THEN
 RAISE EXCEPTION 'outsider preflight granted access'; END IF;
END $$;
RESET ROLE;
UPDATE public.users SET household_id = null WHERE id = '82222222-2222-2222-2222-222222222222';
SELECT set_config('request.jwt.claims', '{"sub":"82222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.babies WHERE id = '8a000000-0000-0000-0000-000000000001' AND deleted = false) THEN
 RAISE EXCEPTION 'removed member preflight granted access'; END IF;
END $$;
RESET ROLE;
UPDATE public.babies SET deleted = true WHERE id = '8a000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claims', '{"sub":"81111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.babies WHERE id = '8a000000-0000-0000-0000-000000000001' AND deleted = false) THEN
 RAISE EXCEPTION 'deleted baby preflight granted access'; END IF;
END $$;
RESET ROLE;
DELETE FROM public.babies WHERE id = '8a000000-0000-0000-0000-000000000001';
DO $$ DECLARE household uuid; BEGIN
 SELECT household_id INTO household FROM public.users WHERE id = '81111111-1111-1111-1111-111111111111';
 UPDATE public.users SET household_id = null WHERE household_id = household;
 DELETE FROM public.households WHERE id = household;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.babies WHERE id = '8a000000-0000-0000-0000-000000000001' AND deleted = false) THEN
 RAISE EXCEPTION 'deleted household preflight granted access'; END IF;
END $$;
ROLLBACK;
