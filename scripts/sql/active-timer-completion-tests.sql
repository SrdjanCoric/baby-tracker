\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email) VALUES
 ('a2111111-1111-1111-1111-111111111111', 'completion-owner@test.dev'),
 ('a2222222-2222-2222-2222-222222222222', 'completion-member@test.dev'),
 ('a2333333-3333-3333-3333-333333333333', 'completion-outsider@test.dev');
UPDATE public.users SET household_id = (SELECT household_id FROM public.users WHERE id = 'a2111111-1111-1111-1111-111111111111')
WHERE id = 'a2222222-2222-2222-2222-222222222222';
INSERT INTO public.babies (id, household_id, name)
SELECT 'a2bbbbbb-0000-0000-0000-000000000001', household_id, 'Completion baby'
FROM public.users WHERE id = 'a2111111-1111-1111-1111-111111111111';

CREATE FUNCTION pg_temp.fail_completion_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('test.fail_completion_delete', true) = 'yes' THEN
   RAISE EXCEPTION 'injected delete failure';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER test_completion_delete BEFORE DELETE ON public.active_timers
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_completion_delete();

DO $$
DECLARE
 owner_id uuid := 'a2111111-1111-1111-1111-111111111111';
 member_id uuid := 'a2222222-2222-2222-2222-222222222222';
 outsider_id uuid := 'a2333333-3333-3333-3333-333333333333';
 target_baby uuid := 'a2bbbbbb-0000-0000-0000-000000000001';
 started timestamptz := date_trunc('milliseconds', now() - interval '5 minutes');
 timer_id text := 'a2aaaaaa-0000-0000-0000-000000000001';
 activity text;
 tbl text;
 scenario text;
 rec jsonb;
 rec_id uuid;
 lock_owner uuid;
 lock_data jsonb;
 lock_start timestamptz;
 caller_id uuid;
 expect_reject boolean;
 expect_clear boolean;
 n integer;
 op_id text;
 result jsonb;
BEGIN
 FOR activity, tbl IN SELECT * FROM (VALUES ('sleep','sleep_sessions'), ('feeding','feedings'),
   ('pumping','pumping_sessions'), ('tummy_time','tummy_time_sessions')) AS types LOOP
  FOREACH scenario IN ARRAY ARRAY['no-lock','own-match','own-match-different-start','other-owner','legacy-match','different-id',
    'legacy-different-start','member-match','member-legacy-match','member-different-id',
    'deleted-baby','no-identity','outsider','anonymous','wrong-user','merge-failure','delete-failure'] LOOP
   UPDATE public.babies SET deleted = (scenario = 'deleted-baby') WHERE id = target_baby;
   rec_id := md5(activity || scenario)::uuid;
   op_id := 'completion-' || activity || '-' || scenario;
   rec := jsonb_build_object('id',rec_id,'baby_id',target_baby,'started_at',started,
     'ended_at',started + interval '5 minutes','duration_seconds',300,'logged_by',owner_id);
   IF activity = 'sleep' THEN rec := rec || '{"type":"nap"}'::jsonb; END IF;
   IF activity = 'feeding' THEN rec := rec || '{"type":"breast"}'::jsonb; END IF;
   lock_owner := CASE WHEN scenario = 'other-owner' THEN member_id ELSE owner_id END;
   lock_data := CASE WHEN (scenario LIKE 'legacy-%' OR scenario = 'member-legacy-match') THEN '{}'::jsonb
     WHEN scenario IN ('different-id','member-different-id') THEN '{"timerInstanceId":"replacement"}'::jsonb
     ELSE jsonb_build_object('timerInstanceId',timer_id) END;
   lock_start := CASE WHEN scenario IN ('legacy-different-start','own-match-different-start') THEN started + interval '1 minute' ELSE started END;
   IF scenario <> 'no-lock' THEN
    INSERT INTO public.active_timers (baby_id,activity_type,started_by,started_at,timer_data)
    VALUES (target_baby,activity,lock_owner,lock_start,lock_data);
   END IF;
   caller_id := CASE WHEN scenario = 'outsider' THEN outsider_id
     WHEN scenario = 'anonymous' THEN NULL
     WHEN scenario LIKE 'member-%' THEN member_id ELSE owner_id END;
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',caller_id)::text,true);
   expect_reject := scenario IN ('outsider','anonymous','wrong-user','merge-failure','delete-failure');
   expect_clear := scenario IN ('own-match','own-match-different-start','other-owner',
     'legacy-match','member-match','member-legacy-match');
   IF scenario = 'merge-failure' THEN rec := rec || '{"started_at":"invalid date"}'::jsonb; END IF;
   PERFORM set_config('test.fail_completion_delete', CASE WHEN scenario = 'delete-failure' THEN 'yes' ELSE 'no' END,true);
   BEGIN
    result := public.merge_record_and_complete_timer(tbl,rec,'{}',op_id,
      CASE WHEN scenario = 'wrong-user' THEN member_id ELSE caller_id END,
      CASE WHEN scenario = 'no-identity' THEN NULL ELSE timer_id END,started);
    IF expect_reject THEN RAISE EXCEPTION 'expected rejection for % %',activity,scenario; END IF;
    IF (result ->> 'id')::uuid IS DISTINCT FROM rec_id THEN
      RAISE EXCEPTION 'merged result wrong for % %',activity,scenario;
    END IF;
   EXCEPTION WHEN OTHERS THEN
    IF NOT expect_reject OR SQLERRM LIKE 'expected rejection%' THEN RAISE; END IF;
    IF scenario IN ('outsider','anonymous','wrong-user') AND SQLSTATE <> '42501' THEN
      RAISE EXCEPTION 'wrong rejection code for % %: %',activity,scenario,SQLSTATE;
    END IF;
    IF scenario = 'delete-failure' AND SQLERRM <> 'injected delete failure' THEN RAISE; END IF;
    IF scenario = 'merge-failure' AND SQLSTATE <> '22007' THEN RAISE; END IF;
   END;
   PERFORM set_config('test.fail_completion_delete','no',true);
   EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1',tbl) INTO n USING rec_id;
   IF n <> (CASE WHEN expect_reject THEN 0 ELSE 1 END) THEN
     RAISE EXCEPTION 'save state wrong for % %',activity,scenario;
   END IF;
   SELECT count(*) INTO n FROM public.active_timers t WHERE t.baby_id = target_baby AND t.activity_type = activity;
   IF n <> (CASE WHEN scenario = 'no-lock' OR expect_clear THEN 0 ELSE 1 END) THEN
     RAISE EXCEPTION 'lock state wrong for % %',activity,scenario;
   END IF;
   IF expect_reject AND EXISTS (SELECT 1 FROM public.sync_operation_acknowledgements WHERE user_id = owner_id AND operation_id = op_id) THEN
     RAISE EXCEPTION 'failure acknowledged for % %',activity,scenario;
   END IF;
   IF NOT expect_reject THEN
    PERFORM public.merge_record_and_complete_timer(tbl,rec,'{}',op_id,caller_id,
      CASE WHEN scenario = 'no-identity' THEN NULL ELSE timer_id END,started);
    SELECT count(*) INTO n FROM public.active_timers t WHERE t.baby_id = target_baby AND t.activity_type = activity;
    IF n <> (CASE WHEN scenario = 'no-lock' OR expect_clear THEN 0 ELSE 1 END) THEN
      RAISE EXCEPTION 'replay lock state wrong for % %',activity,scenario;
    END IF;
    IF scenario = 'member-match' THEN
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id)::text,true);
      PERFORM public.merge_record_and_complete_timer(tbl,rec,'{}',op_id || '-owner',owner_id,timer_id,started);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',member_id)::text,true);
      EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1',tbl) INTO n USING rec_id;
      IF n <> 1 THEN RAISE EXCEPTION 'two-member replay duplicated %',activity; END IF;
      -- A previously accepted operation must still reject a caregiver who has left.
      UPDATE public.users SET household_id = (SELECT household_id FROM public.users WHERE id = outsider_id)
        WHERE id = member_id;
      BEGIN
        PERFORM public.merge_record_and_complete_timer(tbl,rec,'{}',op_id,member_id,timer_id,started);
        RAISE EXCEPTION 'former household member replay accepted';
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
      UPDATE public.users SET household_id = (SELECT household_id FROM public.users WHERE id = owner_id)
        WHERE id = member_id;
    END IF;
    IF expect_clear THEN
      INSERT INTO public.active_timers (baby_id,activity_type,started_by,started_at,timer_data)
      VALUES (target_baby,activity,owner_id,started,jsonb_build_object('timerInstanceId','replacement'));
      PERFORM public.merge_record_and_complete_timer(tbl,rec,'{}',op_id,caller_id,timer_id,started);
      IF NOT EXISTS (SELECT 1 FROM public.active_timers t WHERE t.baby_id = target_baby AND t.activity_type = activity) THEN
       RAISE EXCEPTION 'replay cleared replacement timer';
      END IF;
    END IF;
   END IF;
   UPDATE public.babies SET deleted = false WHERE id = target_baby;
   DELETE FROM public.active_timers t WHERE t.baby_id = target_baby AND t.activity_type = activity;
  END LOOP;
 END LOOP;
END $$;

DO $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_catalog.pg_proc
   WHERE oid = 'public.merge_record_and_complete_timer(text,jsonb,jsonb,text,uuid,text,timestamptz)'::regprocedure
     AND prosecdef AND proconfig @> ARRAY['search_path=""']
 ) THEN RAISE EXCEPTION 'completion definer search path incorrect'; END IF;
 IF has_function_privilege('anon','public.merge_record_and_complete_timer(text,jsonb,jsonb,text,uuid,text,timestamptz)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.merge_record_and_complete_timer(text,jsonb,jsonb,text,uuid,text,timestamptz)','EXECUTE') THEN
  RAISE EXCEPTION 'completion execute grants incorrect';
 END IF;
END $$;
SELECT 'PASS: all four timer completion decision tables, replay, replacement, rollback, grants';
ROLLBACK;
