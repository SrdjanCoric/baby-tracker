CREATE TABLE public.caregiver_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invite_code VARCHAR(8) NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT caregiver_invitations_normalized_email
    CHECK (invited_email = pg_catalog.lower(pg_catalog.btrim(invited_email))),
  CONSTRAINT caregiver_invitations_valid_lifetime
    CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX caregiver_invitations_active_household_email_idx
  ON public.caregiver_invitations (household_id, invited_email)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE INDEX caregiver_invitations_active_code_idx
  ON public.caregiver_invitations (invite_code)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.caregiver_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.caregiver_invitations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.caregiver_invitations TO service_role;

CREATE TABLE public.caregiver_invitation_rollout (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton = true),
  email_binding_enforced BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

INSERT INTO public.caregiver_invitation_rollout (singleton, email_binding_enforced)
VALUES (true, false);

ALTER TABLE public.caregiver_invitation_rollout ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.caregiver_invitation_rollout FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.caregiver_invitation_rollout TO service_role;

CREATE OR REPLACE FUNCTION public.create_caregiver_invitation(p_email TEXT)
RETURNS TABLE (
  invitation_id UUID,
  invited_email TEXT,
  invite_code VARCHAR(8),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_household_id UUID;
  v_email TEXT := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_code VARCHAR(8);
BEGIN
  SELECT caregiver.household_id
  INTO v_household_id
  FROM public.users AS caregiver
  WHERE caregiver.id = v_caller_id
    AND caregiver.is_owner = true;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Only the household owner can manage invitations'
      USING ERRCODE = '42501';
  END IF;

  IF v_email IS NULL
    OR pg_catalog.length(v_email) > 254
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'Invalid caregiver email'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.caregiver_invitations AS invitation
  SET revoked_at = pg_catalog.now()
  WHERE invitation.household_id = v_household_id
    AND invitation.invited_email = v_email
    AND invitation.consumed_at IS NULL
    AND invitation.revoked_at IS NULL;

  v_code := public.generate_secure_invite_code();
  WHILE EXISTS (
    SELECT 1 FROM public.caregiver_invitations AS invitation
    WHERE invitation.invite_code = v_code
  ) OR EXISTS (
    SELECT 1 FROM public.households AS household
    WHERE household.invite_code = v_code
  ) LOOP
    v_code := public.generate_secure_invite_code();
  END LOOP;

  RETURN QUERY
  INSERT INTO public.caregiver_invitations (
    household_id,
    invited_email,
    invite_code,
    created_by,
    expires_at
  )
  VALUES (
    v_household_id,
    v_email,
    v_code,
    v_caller_id,
    pg_catalog.now() + INTERVAL '7 days'
  )
  RETURNING
    caregiver_invitations.id,
    caregiver_invitations.invited_email,
    caregiver_invitations.invite_code,
    caregiver_invitations.expires_at,
    caregiver_invitations.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_caregiver_invitation(TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_caregiver_invitation(TEXT)
TO authenticated;

CREATE OR REPLACE FUNCTION public.list_caregiver_invitations()
RETURNS TABLE (
  invitation_id UUID,
  invited_email TEXT,
  invite_code VARCHAR(8),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_household_id UUID;
BEGIN
  SELECT caregiver.household_id
  INTO v_household_id
  FROM public.users AS caregiver
  WHERE caregiver.id = v_caller_id
    AND caregiver.is_owner = true;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Only the household owner can manage invitations'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    invitation.id,
    invitation.invited_email,
    invitation.invite_code,
    invitation.expires_at,
    invitation.created_at
  FROM public.caregiver_invitations AS invitation
  WHERE invitation.household_id = v_household_id
    AND invitation.consumed_at IS NULL
    AND invitation.revoked_at IS NULL
    AND invitation.expires_at > pg_catalog.now()
  ORDER BY invitation.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_caregiver_invitations()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_caregiver_invitations()
TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_caregiver_invitation(p_invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_household_id UUID;
BEGIN
  SELECT caregiver.household_id
  INTO v_household_id
  FROM public.users AS caregiver
  WHERE caregiver.id = v_caller_id
    AND caregiver.is_owner = true;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Only the household owner can manage invitations'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.caregiver_invitations AS invitation
  SET revoked_at = pg_catalog.now()
  WHERE invitation.id = p_invitation_id
    AND invitation.household_id = v_household_id
    AND invitation.consumed_at IS NULL
    AND invitation.revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_caregiver_invitation(UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_caregiver_invitation(UUID)
TO authenticated;

CREATE OR REPLACE FUNCTION public.join_household_by_invite_code(p_invite_code VARCHAR(8))
RETURNS TABLE (
  household_id UUID,
  household_invite_code VARCHAR(8),
  household_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_email TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
  v_current_household_id UUID;
  v_target_household_id UUID;
  v_invitation public.caregiver_invitations%ROWTYPE;
  v_email_binding_enforced BOOLEAN := true;
  v_attempt_count INTEGER;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.lower(pg_catalog.btrim(account.email)), account.email_confirmed_at
  INTO v_caller_email, v_email_confirmed_at
  FROM auth.users AS account
  WHERE account.id = v_caller_id;

  SELECT pg_catalog.count(*)
  INTO v_attempt_count
  FROM public.join_attempt_logs AS attempt
  WHERE attempt.user_id = v_caller_id
    AND attempt.attempted_at > pg_catalog.now() - INTERVAL '1 hour';

  IF v_attempt_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
  END IF;

  SELECT caregiver.household_id
  INTO v_current_household_id
  FROM public.users AS caregiver
  WHERE caregiver.id = v_caller_id;

  IF v_current_household_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.users AS member
    WHERE member.household_id = v_current_household_id
      AND member.id <> v_caller_id
  ) THEN
    RAISE EXCEPTION 'User already belongs to a household with other members';
  END IF;

  SELECT rollout.email_binding_enforced
  INTO v_email_binding_enforced
  FROM public.caregiver_invitation_rollout AS rollout
  WHERE rollout.singleton = true;
  v_email_binding_enforced := COALESCE(v_email_binding_enforced, true);

  IF p_invite_code IS NOT NULL
    AND p_invite_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
  THEN
    SELECT invitation.*
    INTO v_invitation
    FROM public.caregiver_invitations AS invitation
    WHERE invitation.invite_code = p_invite_code
      AND invitation.consumed_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > pg_catalog.now()
    FOR UPDATE;
  END IF;

  IF v_invitation.id IS NOT NULL
    AND v_email_confirmed_at IS NOT NULL
    AND v_caller_email = v_invitation.invited_email
  THEN
    v_target_household_id := v_invitation.household_id;
  ELSIF NOT v_email_binding_enforced THEN
    SELECT household.id
    INTO v_target_household_id
    FROM public.households AS household
    WHERE pg_catalog.upper(household.invite_code) = pg_catalog.upper(p_invite_code);
  END IF;

  IF v_target_household_id IS NULL THEN
    INSERT INTO public.join_attempt_logs (user_id, invite_code)
    VALUES (v_caller_id, COALESCE(pg_catalog.upper(p_invite_code), ''));
    RETURN;
  END IF;

  IF v_target_household_id = v_current_household_id THEN
    RAISE EXCEPTION 'User already belongs to this household';
  END IF;

  IF v_current_household_id IS NOT NULL THEN
    DELETE FROM public.babies AS baby
    WHERE baby.household_id = v_current_household_id;
  END IF;

  UPDATE public.users AS caregiver
  SET household_id = v_target_household_id,
      is_owner = false
  WHERE caregiver.id = v_caller_id;

  IF v_invitation.id IS NOT NULL
    AND v_target_household_id = v_invitation.household_id
  THEN
    UPDATE public.caregiver_invitations AS invitation
    SET consumed_at = pg_catalog.now(),
        consumed_by = v_caller_id
    WHERE invitation.id = v_invitation.id;
  END IF;

  IF v_current_household_id IS NOT NULL THEN
    DELETE FROM public.households AS household
    WHERE household.id = v_current_household_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.users AS caregiver
        WHERE caregiver.household_id = v_current_household_id
      );
  END IF;

  DELETE FROM public.join_attempt_logs AS attempt
  WHERE attempt.user_id = v_caller_id;

  RETURN QUERY
  SELECT household.id, household.invite_code, household.created_at
  FROM public.households AS household
  WHERE household.id = v_target_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_household_by_invite_code(VARCHAR(8))
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_household_by_invite_code(VARCHAR(8))
TO authenticated;

COMMENT ON TABLE public.caregiver_invitations IS
'Owner-created, email-bound caregiver invitations. Direct client access is denied; security-definer RPCs enforce management and redemption authorization.';

COMMENT ON TABLE public.caregiver_invitation_rollout IS
'Single-row release switch. Legacy household codes remain valid while email_binding_enforced is false; the release owner enables it after the compatible app version is deployed.';

COMMENT ON FUNCTION public.create_caregiver_invitation(TEXT) IS
'Creates or replaces a seven-day invitation for a normalized email. Only the authenticated household owner may call it.';

COMMENT ON FUNCTION public.list_caregiver_invitations() IS
'Lists current unexpired invitations, including readable codes, for the authenticated household owner.';

COMMENT ON FUNCTION public.revoke_caregiver_invitation(UUID) IS
'Revokes a pending invitation only when it belongs to the authenticated household owner.';

COMMENT ON FUNCTION public.join_household_by_invite_code(VARCHAR(8)) IS
'Redeems email-bound invitations for the matching verified auth email. The legacy signature and household-code fallback remain available until the post-release rollout switch enforces email binding.';
