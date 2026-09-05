BEGIN;

-- A timer may have an activity on several devices. Keep tokens after the lock is
-- deleted so the asynchronous send-widget-push webhook can address all of them.
CREATE TABLE public.live_activity_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  timer_instance_id text NOT NULL CHECK (length(timer_instance_id) BETWEEN 1 AND 200),
  activity_id text NOT NULL CHECK (length(activity_id) BETWEEN 1 AND 200),
  device_token text NOT NULL CHECK (length(device_token) BETWEEN 32 AND 1024 AND device_token ~ '^[0-9a-f]+$'),
  is_sandbox boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_id)
);
CREATE INDEX live_activity_push_tokens_timer ON public.live_activity_push_tokens(baby_id, timer_instance_id);
CREATE INDEX live_activity_push_tokens_expiry ON public.live_activity_push_tokens(updated_at);
ALTER TABLE public.live_activity_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_activity_push_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.live_activity_push_tokens TO authenticated;
GRANT ALL ON public.live_activity_push_tokens TO service_role;
CREATE POLICY "Read own Live Activity tokens" ON public.live_activity_push_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Remove own Live Activity tokens" ON public.live_activity_push_tokens
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.register_live_activity_push_token(
  p_baby_id uuid, p_timer_instance_id text, p_activity_id text,
  p_device_token text, p_is_sandbox boolean, p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR v_user_id IS DISTINCT FROM p_user_id OR NOT EXISTS (
    SELECT 1 FROM public.babies baby JOIN public.users caregiver
      ON caregiver.household_id = baby.household_id
    WHERE baby.id = p_baby_id AND caregiver.id = v_user_id AND NOT baby.deleted
  ) THEN
    RAISE EXCEPTION 'Not a household member' USING ERRCODE = '42501';
  END IF;

  -- Serialize registration/rotation with DELETE. Either the token commits before
  -- the webhook is queued, or the missing lock prevents a late orphan insert.
  PERFORM 1 FROM public.active_timers timer
  WHERE timer.baby_id = p_baby_id
    AND timer.timer_data->>'timerInstanceId' = p_timer_instance_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- The timer row lock also serializes concurrent registrations before counting.
  -- Rotation remains available at the cap; a caller cannot create unbounded fan-out.
  IF (SELECT count(*) FROM public.live_activity_push_tokens
      WHERE user_id = v_user_id AND baby_id = p_baby_id
        AND timer_instance_id = p_timer_instance_id AND activity_id <> p_activity_id) >= 8 THEN
    RAISE EXCEPTION 'Live Activity device limit reached' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.live_activity_push_tokens
    (user_id, baby_id, timer_instance_id, activity_id, device_token, is_sandbox)
  VALUES (v_user_id, p_baby_id, p_timer_instance_id, p_activity_id, p_device_token, p_is_sandbox)
  ON CONFLICT (user_id, activity_id) DO UPDATE SET
    baby_id = EXCLUDED.baby_id, timer_instance_id = EXCLUDED.timer_instance_id,
    device_token = EXCLUDED.device_token, is_sandbox = EXCLUDED.is_sandbox,
    updated_at = pg_catalog.now();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.register_live_activity_push_token(uuid,text,text,text,boolean,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_live_activity_push_token(uuid,text,text,text,boolean,uuid) TO authenticated;

-- Backstop for a missed webhook, a killed app, or a failed cleanup request.
-- ActivityKit activities and timer locks expire well before this retention bound.
SELECT cron.schedule('cleanup-live-activity-push-tokens', '17 * * * *',
  $cron$DELETE FROM public.live_activity_push_tokens WHERE updated_at < now() - interval '24 hours'$cron$);

COMMIT;
