BEGIN;

-- Push-to-start tokens identify an installation, not one running activity.
-- Per-activity update/end tokens remain in live_activity_push_tokens (066).
CREATE TABLE public.live_activity_start_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id text NOT NULL CHECK (length(device_id) BETWEEN 1 AND 200),
  device_token text NOT NULL CHECK (length(device_token) BETWEEN 32 AND 1024 AND device_token ~ '^[0-9a-f]+$'),
  is_sandbox boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
CREATE INDEX live_activity_start_tokens_updated_at_idx ON public.live_activity_start_tokens(updated_at);
CREATE INDEX live_activity_start_tokens_device_token_idx ON public.live_activity_start_tokens(device_token);
ALTER TABLE public.live_activity_start_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_activity_start_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.live_activity_start_tokens TO authenticated;
GRANT ALL ON public.live_activity_start_tokens TO service_role;
CREATE POLICY "Read own Live Activity start tokens" ON public.live_activity_start_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Remove own Live Activity start tokens" ON public.live_activity_start_tokens
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.register_live_activity_start_token(
  p_device_id text, p_device_token text, p_is_sandbox boolean, p_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR v_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not the token owner' USING ERRCODE = '42501';
  END IF;
  -- Serialize ownership transfers of the same APNs token across accounts.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_device_token, 0));
  DELETE FROM public.live_activity_start_tokens
    WHERE device_token = p_device_token AND user_id <> v_user_id;
  -- Serialize device-limit checks and rotations within one account.
  PERFORM 1 FROM public.users WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE = '42501'; END IF;
  -- Keep room for this installation, evicting the least recently refreshed devices.
  DELETE FROM public.live_activity_start_tokens WHERE id IN (
    SELECT id FROM public.live_activity_start_tokens
    WHERE user_id = v_user_id AND device_id <> p_device_id
    ORDER BY updated_at DESC, id DESC OFFSET 7
  );
  INSERT INTO public.live_activity_start_tokens(user_id, device_id, device_token, is_sandbox)
  VALUES (v_user_id, p_device_id, p_device_token, p_is_sandbox)
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    device_token = EXCLUDED.device_token, is_sandbox = EXCLUDED.is_sandbox, updated_at = pg_catalog.now();
END $$;
REVOKE ALL ON FUNCTION public.register_live_activity_start_token(text,text,boolean,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_live_activity_start_token(text,text,boolean,uuid) TO authenticated;

-- Backstop for failed sign-out and installations that no longer refresh.
SELECT cron.schedule('cleanup-live-activity-start-tokens', '23 * * * *',
  $cron$DELETE FROM public.live_activity_start_tokens WHERE updated_at < now() - interval '24 hours'$cron$);

COMMIT;
