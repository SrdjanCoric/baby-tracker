\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('81111111-1111-1111-1111-111111111111', 'invitation-owner@test.dev', pg_catalog.now()),
  ('82222222-2222-2222-2222-222222222222', 'recipient@test.dev', pg_catalog.now()),
  ('83333333-3333-3333-3333-333333333333', 'wrong-account@test.dev', pg_catalog.now()),
  ('84444444-4444-4444-4444-444444444444', 'unverified@test.dev', NULL),
  ('85555555-5555-5555-5555-555555555555', 'expired@test.dev', pg_catalog.now()),
  ('86666666-6666-6666-6666-666666666666', 'household-member@test.dev', pg_catalog.now()),
  ('87777777-7777-7777-7777-777777777777', 'revoked@test.dev', pg_catalog.now()),
  ('88888888-8888-8888-8888-888888888888', 'replacement-recipient@test.dev', pg_catalog.now()),
  ('89999999-9999-9999-9999-999999999999', 'legacy-recipient@test.dev', pg_catalog.now());

UPDATE public.users
SET household_id = (
      SELECT household_id
      FROM public.users
      WHERE id = '81111111-1111-1111-1111-111111111111'
    ),
    is_owner = false
WHERE id = '86666666-6666-6666-6666-666666666666';

DO $$
DECLARE
  v_email_binding_enforced BOOLEAN;
BEGIN
  SELECT email_binding_enforced
  INTO v_email_binding_enforced
  FROM public.caregiver_invitation_rollout
  WHERE singleton = true;

  IF v_email_binding_enforced IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'migration must default to legacy-compatible invitation rollout';
  END IF;

  IF has_table_privilege('anon', 'public.caregiver_invitations', 'SELECT')
    OR has_table_privilege('authenticated', 'public.caregiver_invitations', 'SELECT')
    OR has_table_privilege('authenticated', 'public.caregiver_invitations', 'INSERT')
    OR has_table_privilege('authenticated', 'public.caregiver_invitations', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.caregiver_invitations', 'DELETE')
  THEN
    RAISE EXCEPTION 'clients must not access caregiver invitation rows directly';
  END IF;

  IF has_table_privilege('anon', 'public.caregiver_invitation_rollout', 'SELECT')
    OR has_table_privilege('authenticated', 'public.caregiver_invitation_rollout', 'SELECT')
    OR has_table_privilege('authenticated', 'public.caregiver_invitation_rollout', 'UPDATE')
  THEN
    RAISE EXCEPTION 'clients must not access invitation rollout state directly';
  END IF;

  IF has_function_privilege('anon', 'public.create_caregiver_invitation(text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.list_caregiver_invitations()', 'EXECUTE')
    OR has_function_privilege('anon', 'public.revoke_caregiver_invitation(uuid)', 'EXECUTE')
    OR has_function_privilege(
      'anon',
      'public.join_household_by_invite_code(character varying)',
      'EXECUTE'
    )
    OR NOT has_function_privilege(
      'authenticated',
      'public.join_household_by_invite_code(character varying)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'invitation RPC grants do not enforce authenticated access';
  END IF;
END
$$;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '81111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT *
  INTO v_invitation
  FROM public.create_caregiver_invitation(' Caregiver@Test.Dev ');

  IF v_invitation.invited_email <> 'caregiver@test.dev'
    OR v_invitation.invite_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
    OR v_invitation.expires_at < pg_catalog.now() + INTERVAL '6 days 23 hours'
  THEN
    RAISE EXCEPTION 'owner did not receive a normalized seven-day invitation: %', row_to_json(v_invitation);
  END IF;
END
$$;

DO $$
DECLARE
  v_pending RECORD;
BEGIN
  SELECT *
  INTO v_pending
  FROM public.list_caregiver_invitations();

  IF v_pending.invited_email <> 'caregiver@test.dev'
    OR v_pending.invite_code IS NULL
    OR v_pending.expires_at <= pg_catalog.now()
  THEN
    RAISE EXCEPTION 'owner could not list the pending invitation';
  END IF;
END
$$;

DO $$
DECLARE
  v_invitation_id UUID;
  v_revoked BOOLEAN;
  v_remaining INTEGER;
BEGIN
  SELECT invitation_id
  INTO v_invitation_id
  FROM public.list_caregiver_invitations();

  SELECT public.revoke_caregiver_invitation(v_invitation_id)
  INTO v_revoked;

  SELECT pg_catalog.count(*)
  INTO v_remaining
  FROM public.list_caregiver_invitations();

  IF NOT v_revoked OR v_remaining <> 0 THEN
    RAISE EXCEPTION 'owner could not revoke a pending invitation';
  END IF;
END
$$;

DO $$
DECLARE
  v_first RECORD;
  v_replacement RECORD;
  v_other RECORD;
  v_active_same_email INTEGER;
  v_active_total INTEGER;
  v_invalid_email_rejected BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.create_caregiver_invitation('not-an-email');
  EXCEPTION WHEN invalid_parameter_value THEN
    v_invalid_email_rejected := true;
  END;

  IF NOT v_invalid_email_rejected THEN
    RAISE EXCEPTION 'malformed caregiver email was accepted';
  END IF;

  SELECT * INTO v_first
  FROM public.create_caregiver_invitation('replace@test.dev');
  SELECT * INTO v_replacement
  FROM public.create_caregiver_invitation(' REPLACE@Test.Dev ');
  SELECT * INTO v_other
  FROM public.create_caregiver_invitation('other@test.dev');

  SELECT pg_catalog.count(*)
  INTO v_active_same_email
  FROM public.list_caregiver_invitations()
  WHERE invited_email = 'replace@test.dev';

  SELECT pg_catalog.count(*)
  INTO v_active_total
  FROM public.list_caregiver_invitations();

  IF v_first.invite_code = v_replacement.invite_code
    OR v_active_same_email <> 1
    OR v_active_total <> 2
  THEN
    RAISE EXCEPTION 'replacement or multiple pending invitations did not behave correctly';
  END IF;

  PERFORM public.revoke_caregiver_invitation(v_replacement.invitation_id);
  PERFORM public.revoke_caregiver_invitation(v_other.invitation_id);
END
$$;

SELECT invite_code AS recipient_code
FROM public.create_caregiver_invitation('recipient@test.dev')
\gset

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '86666666-6666-6666-6666-666666666666', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_create_denied BOOLEAN := false;
  v_list_denied BOOLEAN := false;
  v_revoke_denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.create_caregiver_invitation('unauthorized@test.dev');
  EXCEPTION WHEN insufficient_privilege THEN
    v_create_denied := true;
  END;

  BEGIN
    PERFORM * FROM public.list_caregiver_invitations();
  EXCEPTION WHEN insufficient_privilege THEN
    v_list_denied := true;
  END;

  BEGIN
    PERFORM public.revoke_caregiver_invitation(
      '00000000-0000-0000-0000-000000000001'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_revoke_denied := true;
  END;

  IF NOT v_create_denied OR NOT v_list_denied OR NOT v_revoke_denied THEN
    RAISE EXCEPTION 'a non-owner managed caregiver invitations';
  END IF;
END
$$;

RESET ROLE;
SELECT set_config('test.recipient_invite_code', :'recipient_code', true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '82222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_joined_household_id UUID;
BEGIN
  SELECT household_id
  INTO v_joined_household_id
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.recipient_invite_code')::VARCHAR(8)
  );

  IF v_joined_household_id IS NULL THEN
    RAISE EXCEPTION 'matching verified recipient did not join the owner household';
  END IF;
END
$$;

RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.caregiver_invitations
    WHERE invite_code = pg_catalog.current_setting('test.recipient_invite_code')
      AND consumed_by = '82222222-2222-2222-2222-222222222222'
      AND consumed_at IS NOT NULL
  ) OR (
    SELECT recipient.household_id IS DISTINCT FROM owner.household_id
    FROM public.users AS recipient
    CROSS JOIN public.users AS owner
    WHERE recipient.id = '82222222-2222-2222-2222-222222222222'
      AND owner.id = '81111111-1111-1111-1111-111111111111'
  ) THEN
    RAISE EXCEPTION 'successful invitation was not consumed atomically';
  END IF;
END
$$;

INSERT INTO public.households (invite_code)
VALUES ('RPLYCOD1')
RETURNING id AS replay_household_id
\gset
UPDATE public.users
SET household_id = :'replay_household_id',
    is_owner = true
WHERE id = '82222222-2222-2222-2222-222222222222';

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '82222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO v_result_count
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.recipient_invite_code')::VARCHAR(8)
  );
  IF v_result_count <> 0 THEN
    RAISE EXCEPTION 'a consumed invitation was redeemed twice';
  END IF;
END
$$;
RESET ROLE;

SELECT household.invite_code AS legacy_code
FROM public.households AS household
JOIN public.users AS owner ON owner.household_id = household.id
WHERE owner.id = '81111111-1111-1111-1111-111111111111'
\gset

SELECT set_config('test.legacy_code', :'legacy_code', true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '89999999-9999-9999-9999-999999999999', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO v_result_count
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.legacy_code')::VARCHAR(8)
  );
  IF v_result_count <> 1 THEN
    RAISE EXCEPTION 'a legacy recipient could not join during compatibility rollout';
  END IF;
END
$$;
RESET ROLE;

UPDATE public.caregiver_invitation_rollout
SET email_binding_enforced = true,
    updated_at = pg_catalog.now()
WHERE singleton = true;

DO $$
BEGIN
  IF NOT (
    SELECT email_binding_enforced
    FROM public.caregiver_invitation_rollout
    WHERE singleton = true
  ) THEN
    RAISE EXCEPTION 'email-bound invitation rollout could not be enforced';
  END IF;
END
$$;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '81111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT invite_code AS wrong_email_code
FROM public.create_caregiver_invitation('intended@test.dev')
\gset
SELECT invite_code AS unverified_code
FROM public.create_caregiver_invitation('unverified@test.dev')
\gset
SELECT invite_code AS expired_code
FROM public.create_caregiver_invitation('expired@test.dev')
\gset
SELECT invitation_id AS revoked_id, invite_code AS revoked_code
FROM public.create_caregiver_invitation('revoked@test.dev')
\gset
SELECT invite_code AS replaced_code
FROM public.create_caregiver_invitation('replacement-recipient@test.dev')
\gset
SELECT invite_code AS replacement_code
FROM public.create_caregiver_invitation(' REPLACEMENT-RECIPIENT@Test.Dev ')
\gset
SELECT public.revoke_caregiver_invitation(:'revoked_id');
RESET ROLE;

SELECT set_config('test.wrong_email_code', :'wrong_email_code', true);
SELECT set_config('test.unverified_code', :'unverified_code', true);
SELECT set_config('test.expired_code', :'expired_code', true);
SELECT set_config('test.revoked_code', :'revoked_code', true);
SELECT set_config('test.replaced_code', :'replaced_code', true);
SELECT set_config('test.replacement_code', :'replacement_code', true);
SELECT set_config('test.legacy_code', :'legacy_code', true);

UPDATE public.caregiver_invitations
SET created_at = pg_catalog.now() - INTERVAL '8 days',
    expires_at = pg_catalog.now() - INTERVAL '1 day'
WHERE invite_code = :'expired_code';

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '88888888-8888-8888-8888-888888888888', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO v_result_count
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.replaced_code')::VARCHAR(8)
  );
  IF v_result_count <> 0 THEN
    RAISE EXCEPTION 'a replaced invitation code was redeemed';
  END IF;

  SELECT pg_catalog.count(*) INTO v_result_count
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.replacement_code')::VARCHAR(8)
  );
  IF v_result_count <> 1 THEN
    RAISE EXCEPTION 'the replacement invitation code was not redeemable';
  END IF;
END
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '83333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result_count INTEGER;
  v_rate_limited BOOLEAN := false;
BEGIN
  SELECT pg_catalog.count(*) INTO v_result_count
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.wrong_email_code')::VARCHAR(8)
  );
  IF v_result_count <> 0 THEN
    RAISE EXCEPTION 'a non-matching email redeemed an invitation';
  END IF;

  SELECT pg_catalog.count(*) INTO v_result_count
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.legacy_code')::VARCHAR(8)
  );
  IF v_result_count <> 0 THEN
    RAISE EXCEPTION 'a legacy household-wide code authorized a join';
  END IF;

  FOR i IN 1..3 LOOP
    PERFORM * FROM public.join_household_by_invite_code('BADCODE2');
  END LOOP;

  BEGIN
    PERFORM * FROM public.join_household_by_invite_code('BADCODE3');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Rate limit exceeded%' THEN
      v_rate_limited := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_rate_limited THEN
    RAISE EXCEPTION 'server-side invitation attempt limiting was not enforced';
  END IF;
END
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '84444444-4444-4444-4444-444444444444', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO v_result_count
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.unverified_code')::VARCHAR(8)
  );
  IF v_result_count <> 0 THEN
    RAISE EXCEPTION 'an unverified email redeemed an invitation';
  END IF;
END
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '85555555-5555-5555-5555-555555555555', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO v_result_count
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.expired_code')::VARCHAR(8)
  );
  IF v_result_count <> 0 THEN
    RAISE EXCEPTION 'an expired invitation was redeemed';
  END IF;
END
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '87777777-7777-7777-7777-777777777777', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_result_count INTEGER;
BEGIN
  SELECT pg_catalog.count(*) INTO v_result_count
  FROM public.join_household_by_invite_code(
    pg_catalog.current_setting('test.revoked_code')::VARCHAR(8)
  );
  IF v_result_count <> 0 THEN
    RAISE EXCEPTION 'a revoked invitation was redeemed';
  END IF;
END
$$;
RESET ROLE;

ROLLBACK;
