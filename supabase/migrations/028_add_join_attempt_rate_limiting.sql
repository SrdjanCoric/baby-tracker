-- Rate limiting for invite code join attempts
-- Prevents brute-force guessing of invite codes
-- Limit: 5 failed attempts per user per hour

CREATE TABLE join_attempt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invite_code VARCHAR(8) NOT NULL
);

CREATE INDEX idx_join_attempt_logs_user_time ON join_attempt_logs(user_id, attempted_at DESC);

ALTER TABLE join_attempt_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempt logs"
  ON join_attempt_logs FOR SELECT
  USING (user_id = auth.uid());

-- Updated function with server-side rate limiting
DROP FUNCTION IF EXISTS join_household_by_invite_code(VARCHAR(8));

CREATE OR REPLACE FUNCTION join_household_by_invite_code(p_invite_code VARCHAR(8))
RETURNS TABLE (household_id UUID, household_invite_code VARCHAR(8), household_created_at TIMESTAMPTZ) AS $$
DECLARE
  v_target_household_id UUID;
  v_current_household_id UUID;
  v_attempt_count INT;
BEGIN
  -- Rate limit check: max 5 attempts in the last hour
  SELECT COUNT(*) INTO v_attempt_count
  FROM join_attempt_logs
  WHERE user_id = auth.uid()
  AND attempted_at > now() - INTERVAL '1 hour';

  IF v_attempt_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
  END IF;

  -- Get user's current household
  SELECT u.household_id INTO v_current_household_id
  FROM users u
  WHERE u.id = auth.uid();

  -- Check if user already belongs to a household with other members
  IF v_current_household_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM users u2
      WHERE u2.household_id = v_current_household_id
      AND u2.id != auth.uid()
    ) THEN
      RAISE EXCEPTION 'User already belongs to a household with other members';
    END IF;
  END IF;

  -- Find household by invite code (case-insensitive)
  SELECT h.id INTO v_target_household_id
  FROM households h
  WHERE UPPER(h.invite_code) = UPPER(p_invite_code);

  IF v_target_household_id IS NULL THEN
    -- Log failed attempt (wrong code = brute force signal)
    INSERT INTO join_attempt_logs (user_id, invite_code)
    VALUES (auth.uid(), UPPER(p_invite_code));

    RAISE EXCEPTION 'Household not found';
  END IF;

  -- Don't allow joining own household
  IF v_target_household_id = v_current_household_id THEN
    RAISE EXCEPTION 'User already belongs to this household';
  END IF;

  -- Delete babies from old household (user was warned about data loss)
  IF v_current_household_id IS NOT NULL THEN
    DELETE FROM babies
    WHERE babies.household_id = v_current_household_id;
  END IF;

  -- Update user's household_id to the new household and set is_owner = false
  UPDATE users
  SET household_id = v_target_household_id, is_owner = false
  WHERE users.id = auth.uid();

  -- Delete the old empty household if it exists and has no members
  IF v_current_household_id IS NOT NULL THEN
    DELETE FROM households
    WHERE households.id = v_current_household_id
    AND NOT EXISTS (
      SELECT 1 FROM users u3 WHERE u3.household_id = v_current_household_id
    );
  END IF;

  -- Successful join: clear attempt logs for this user
  DELETE FROM join_attempt_logs
  WHERE user_id = auth.uid();

  -- Return the joined household data
  RETURN QUERY
  SELECT h.id AS household_id, h.invite_code AS household_invite_code, h.created_at AS household_created_at
  FROM households h
  WHERE h.id = v_target_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
