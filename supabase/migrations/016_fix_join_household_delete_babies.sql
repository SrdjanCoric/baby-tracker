-- Fix: Delete babies from old household when joining a new one
-- The previous function failed with foreign key constraint error because
-- babies were still linked to the old household when trying to delete it
-- User is warned about data loss before joining, so deletion is expected

DROP FUNCTION IF EXISTS join_household_by_invite_code(VARCHAR(8));

CREATE OR REPLACE FUNCTION join_household_by_invite_code(p_invite_code VARCHAR(8))
RETURNS TABLE (household_id UUID, household_invite_code VARCHAR(8), household_created_at TIMESTAMPTZ) AS $$
DECLARE
  v_target_household_id UUID;
  v_current_household_id UUID;
BEGIN
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

  -- Return the joined household data
  RETURN QUERY
  SELECT h.id AS household_id, h.invite_code AS household_invite_code, h.created_at AS household_created_at
  FROM households h
  WHERE h.id = v_target_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
